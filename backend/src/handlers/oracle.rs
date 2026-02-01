use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
};
use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};
use serde_json::json;
use shared_crypto::intent::Intent;
use std::path::PathBuf;
use std::str::FromStr;
use sui_keys::keystore::{AccountKeystore, FileBasedKeystore};
use sui_sdk::{
    json::SuiJsonValue,
    rpc_types::{SuiTransactionBlockEffectsAPI, SuiTransactionBlockResponseOptions},
    types::{base_types::ObjectID, transaction::Transaction},
    SuiClientBuilder,
};

#[derive(Deserialize)]
pub struct ResolveMarketRequest {
    pub market_id: String,
    pub winner: u8, // Winner option index (0, 1, 2, etc.) for multi-option markets
}

#[derive(Serialize)]
pub struct ResolveMarketResponse {
    pub digest: String,
    pub status: String,
}

pub async fn resolve_market(
    State(_db): State<DatabaseConnection>,
    Json(payload): Json<ResolveMarketRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // 1. Load config
    let network = std::env::var("SUI_NETWORK")
        .unwrap_or_else(|_| "https://fullnode.testnet.sui.io:443".to_string());
    let package_id_str = std::env::var("PACKAGE_ID").map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "PACKAGE_ID not set".to_string(),
        )
    })?;

    // 2. Setup Client
    let client = SuiClientBuilder::default()
        .build(&network)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to create Sui client: {}", e),
            )
        })?;

    // 3. Load Keystore (Admin Wallet) - same approach as contract.rs
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let keystore_path = PathBuf::from(home).join(".sui/sui_config/sui.keystore");

    let keystore = FileBasedKeystore::load_or_create(&keystore_path).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to load keystore: {}", e),
        )
    })?;

    let addresses = keystore.addresses();
    if addresses.is_empty() {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            "No accounts found in sui.keystore".to_string(),
        ));
    }
    let sender = addresses[0];

    println!("Oracle: Using Admin Account: {}", sender);

    // 4. Prepare Arguments
    let market_id = ObjectID::from_str(&payload.market_id)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid Market ID: {}", e)))?;
    let package_id = ObjectID::from_str(&package_id_str).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Invalid Package ID: {}", e),
        )
    })?;

    // 5. Build Transaction
    let gas_price = client
        .read_api()
        .get_reference_gas_price()
        .await
        .unwrap_or(1000);

    let market_arg = SuiJsonValue::from_object_id(market_id);
    let winner_arg = SuiJsonValue::new(json!(payload.winner)).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to create winner arg: {}", e),
        )
    })?;

    let tx_data = client
        .transaction_builder()
        .move_call(
            sender,
            package_id,
            "market",
            "resolve_market",
            vec![], // type_args
            vec![market_arg, winner_arg],
            None,       // gas
            50_000_000, // gas_budget
            Some(gas_price),
        )
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to build transaction data: {}", e),
            )
        })?;

    // Sign using keystore
    let signature = keystore
        .sign_secure(&sender, &tx_data, Intent::sui_transaction())
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to sign transaction: {}", e),
            )
        })?;

    // Execute
    let response = client
        .quorum_driver_api()
        .execute_transaction_block(
            Transaction::from_data(tx_data, vec![signature]),
            SuiTransactionBlockResponseOptions::new()
                .with_effects()
                .with_events(),
            None,
        )
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to execute transaction: {}", e),
            )
        })?;

    Ok(Json(ResolveMarketResponse {
        digest: response.digest.to_string(),
        status: format!("{:?}", response.effects.as_ref().map(|e| e.status())),
    }))
}
