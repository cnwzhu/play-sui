use crate::entities::contract;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use serde::Deserialize;
use shared_crypto::intent::Intent;
use std::path::PathBuf;
use std::str::FromStr;
use sui_keys::keystore::{AccountKeystore, FileBasedKeystore};
use sui_sdk::{
    rpc_types::{SuiExecutionStatus, SuiTransactionBlockResponseOptions},
    types::{
        base_types::ObjectID,
        transaction::{CallArg, Transaction, TransactionData},
    },
    SuiClientBuilder,
};

#[derive(Deserialize)]
pub struct CreateContract {
    pub name: String,
    pub address: Option<String>,
    pub description: Option<String>,
    pub options: Option<Vec<String>>,
    pub category_id: Option<i32>,
}

#[derive(Deserialize)]
pub struct ListContractParams {
    pub category_id: Option<i32>,
    pub q: Option<String>,
}

pub async fn list_contracts(
    State(db): State<DatabaseConnection>,
    Query(params): Query<ListContractParams>,
) -> Result<Json<Vec<contract::Model>>, (StatusCode, String)> {
    let mut query = contract::Entity::find();

    if let Some(cat_id) = params.category_id {
        query = query.filter(contract::Column::CategoryId.eq(cat_id));
    }

    if let Some(q) = params.q {
        if !q.trim().is_empty() {
            let filter = q.trim();
            // Case insensitive search using LIKE '%q%'
            // Note: SQLite LIKE is case-insensitive by default for ASCII
            query = query.filter(contract::Column::Name.contains(filter));
        }
    }

    let contracts = query
        .all(&db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(contracts))
}

pub async fn create_contract(
    State(db): State<DatabaseConnection>,
    axum::Extension(tx): axum::Extension<tokio::sync::mpsc::Sender<()>>,
    Json(payload): Json<CreateContract>,
) -> Result<Json<contract::Model>, (StatusCode, String)> {
    // 1. Determine the address (Import or Create)
    let contract_address = if let Some(addr) = payload.address.filter(|a| !a.trim().is_empty()) {
        addr
    } else {
        // 2. Perform On-Chain Creation
        create_market_on_chain(
            &payload.name,
            payload.options.as_ref().map(|v| v.len()).unwrap_or(2) as u8,
        )
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("On-chain creation failed: {}", e),
            )
        })?
    };

    let options_json = payload
        .options
        .map(|opts| serde_json::to_string(&opts).unwrap_or("[]".to_string()));

    let new_contract = contract::ActiveModel {
        name: Set(payload.name),
        address: Set(contract_address),
        description: Set(payload.description),
        options: Set(options_json),
        category_id: Set(payload.category_id),
        ..Default::default()
    };

    let contract = new_contract
        .insert(&db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Trigger instant indexer refresh
    let _ = tx.send(()).await;

    Ok(Json(contract))
}

pub async fn delete_contract(
    State(db): State<DatabaseConnection>,
    Path(id): Path<i32>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = contract::Entity::delete_by_id(id)
        .exec(&db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected == 0 {
        return Err((StatusCode::NOT_FOUND, "Contract not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// --- Helper Functions ---

const PACKAGE_ID: &str = "0x364b4ffa3f81580b37fc32ef472410f313d31e8f82c3daad4d4dd4ed886e88fd";
const SUI_NETWORK_URL: &str = "https://fullnode.testnet.sui.io:443";

async fn create_market_on_chain(
    question: &str,
    options_count: u8,
) -> Result<String, Box<dyn std::error::Error>> {
    println!(
        "Creating market on chain... Question: {}, Options: {}",
        question, options_count
    );

    // 1. Setup Client
    let sui_client = SuiClientBuilder::default().build(SUI_NETWORK_URL).await?;

    // 2. Load Keystore (Admin Wallet)
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let keystore_path = PathBuf::from(home).join(".sui/sui_config/sui.keystore");

    let keystore = FileBasedKeystore::load_or_create(&keystore_path)?;
    let addresses = keystore.addresses();
    if addresses.is_empty() {
        return Err("No accounts found in sui.keystore".into());
    }
    let sender = addresses[0];
    // let _keypair = keystore.get_key(&sender)?;

    println!("Using Admin Account: {}", sender);

    // 3. Prepare Arguments
    let package_id = ObjectID::from_str(PACKAGE_ID)?;
    let module = "market";
    let function = "create_market";

    let pure_question = bcs::to_bytes(&question.as_bytes().to_vec())?;
    let pure_options_count = bcs::to_bytes(&options_count)?;
    let pure_oracle = bcs::to_bytes(&sender)?;

    // 4. Construct Transaction
    // Get gas object (Pick first available coin with enough balance)
    let coins = sui_client
        .coin_read_api()
        .get_coins(sender, None, None, None)
        .await?;

    // Simple gas selection: just take the first one.
    // In production, we should merge coins or pick one with > budget.
    let coin = coins.data.into_iter().next().ok_or("No gas coins found")?;
    let gas_payment = coin.coin_object_id;
    let gas_budget = 50_000_000;
    let gas_price = sui_client.read_api().get_reference_gas_price().await?;

    // Get the gas object ref
    let pt_response = sui_client
        .read_api()
        .get_object_with_options(
            gas_payment,
            sui_sdk::rpc_types::SuiObjectDataOptions::new().with_owner(),
        )
        .await?;

    let gas_obj_ref = pt_response.into_object()?.object_ref();

    let tx_data = TransactionData::new_move_call(
        sender,
        package_id,
        sui_sdk::types::Identifier::from_str(module)?,
        sui_sdk::types::Identifier::from_str(function)?,
        vec![],
        gas_obj_ref,
        vec![
            CallArg::Pure(pure_question),
            CallArg::Pure(pure_options_count),
            CallArg::Pure(pure_oracle),
        ],
        gas_budget,
        gas_price,
    )?;

    // 5. Sign and Execute
    let signature = keystore
        .sign_secure(&sender, &tx_data, Intent::sui_transaction())
        .await?;
    let transaction = Transaction::from_data(tx_data, vec![signature]);

    let response = sui_client
        .quorum_driver_api()
        .execute_transaction_block(
            transaction,
            SuiTransactionBlockResponseOptions::new()
                .with_effects()
                .with_events(),
            None,
        )
        .await?;

    if let Some(effects) = response.effects {
        // Check status manually since trait might be missing or complex
        let status = match &effects {
            sui_sdk::rpc_types::SuiTransactionBlockEffects::V1(v1) => v1.status.clone(),
        };
        if matches!(status, SuiExecutionStatus::Failure { .. }) {
            return Err(format!("Transaction failed: {:?}", status).into());
        }

        if let Some(events) = response.events {
            for event in events.data {
                if event.type_.name.as_str().contains("MarketCreated") {
                    let json_val = event.parsed_json;
                    if let Some(id_val) = json_val.get("id") {
                        let id_str = id_val.as_str().unwrap_or_default().to_string();
                        println!("Found Market ID from Event: {}", id_str);
                        return Ok(id_str);
                    }
                }
            }
        }
    }

    Err("Failed to retrieve created Market ID".into())
}
