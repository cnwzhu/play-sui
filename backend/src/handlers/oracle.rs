use anyhow::Result;
use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
};
use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};
use serde_json::json;
use shared_crypto::intent::{Intent, IntentMessage};
use std::str::FromStr;
use sui_sdk::{
    json::SuiJsonValue,
    rpc_types::{SuiTransactionBlockEffectsAPI, SuiTransactionBlockResponseOptions},
    types::{
        base_types::{ObjectID, SuiAddress},
        crypto::{EncodeDecodeBase64, Signature, SuiKeyPair},
        transaction::{Transaction, TransactionData},
    },
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
    let admin_mnemonic = std::env::var("ADMIN_MNEMONIC").map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "ADMIN_MNEMONIC not set".to_string(),
        )
    })?;
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

    // 3. Setup Keypair
    // Support `suiprivkey...` (Bech32) or Base64.
    let keypair = SuiKeyPair::decode(&admin_mnemonic)
        .or_else(|_| SuiKeyPair::decode_base64(&admin_mnemonic))
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!(
                    "Failed to decode ADMIN_MNEMONIC (must be private key): {}",
                    e
                ),
            )
        })?;

    let sender = SuiAddress::from(&keypair.public());

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

    let tx_data: TransactionData = client
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

    // Sign
    let intent_msg = IntentMessage::new(Intent::sui_transaction(), tx_data.clone());
    let signature = Signature::new_secure(&intent_msg, &keypair);

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
