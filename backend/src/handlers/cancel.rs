use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
};
use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};
use shared_crypto::intent::Intent;
use std::path::PathBuf;
use std::str::FromStr;
use sui_keys::keystore::{AccountKeystore, FileBasedKeystore};
use sui_sdk::{
    json::SuiJsonValue,
    rpc_types::SuiTransactionBlockResponseOptions,
    types::{base_types::ObjectID, transaction::Transaction},
    SuiClientBuilder,
};

#[derive(Deserialize)]
pub struct CancelMarketRequest {
    pub market_id: String,
}

#[derive(Serialize)]
pub struct CancelMarketResponse {
    pub digest: String,
    pub status: String,
}

/// Cancel a market on-chain (refund all bets)
/// Called by the backend cron when market expires, or manually by admin
pub async fn cancel_market(
    State(_db): State<DatabaseConnection>,
    Json(payload): Json<CancelMarketRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    match execute_cancel_market(&payload.market_id).await {
        Ok(digest) => Ok(Json(CancelMarketResponse {
            digest,
            status: "Success".to_string(), // Simplified status since we don't return effects here
        })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}

pub async fn execute_cancel_market(market_id_str: &str) -> Result<String, String> {
    // 1. Load config
    let network = std::env::var("SUI_NETWORK")
        .unwrap_or_else(|_| "https://fullnode.testnet.sui.io:443".to_string());
    let package_id_str =
        std::env::var("PACKAGE_ID").map_err(|_| "PACKAGE_ID not set".to_string())?;

    // 2. Setup Client
    let client = SuiClientBuilder::default()
        .build(&network)
        .await
        .map_err(|e| format!("Failed to create Sui client: {}", e))?;

    // 3. Load Keystore (Admin Wallet)
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let keystore_path = PathBuf::from(home).join(".sui/sui_config/sui.keystore");

    let keystore = FileBasedKeystore::load_or_create(&keystore_path)
        .map_err(|e| format!("Failed to load keystore: {}", e))?;

    let addresses = keystore.addresses();
    if addresses.is_empty() {
        return Err("No accounts found in sui.keystore".to_string());
    }
    let sender = addresses[0];

    println!("Cancel: Using Admin Account: {}", sender);

    // 4. Prepare Arguments
    let market_id =
        ObjectID::from_str(market_id_str).map_err(|e| format!("Invalid Market ID: {}", e))?;
    let package_id =
        ObjectID::from_str(&package_id_str).map_err(|e| format!("Invalid Package ID: {}", e))?;

    // 5. Build Transaction
    let gas_price = client
        .read_api()
        .get_reference_gas_price()
        .await
        .unwrap_or(1000);

    let market_arg = SuiJsonValue::from_object_id(market_id);

    // Clock object is at 0x6
    let clock_id = ObjectID::from_str("0x6").unwrap();
    let clock_arg = SuiJsonValue::from_object_id(clock_id);

    let tx_data = client
        .transaction_builder()
        .move_call(
            sender,
            package_id,
            "market",
            "cancel_market",
            vec![], // type_args
            vec![market_arg, clock_arg],
            None,       // gas
            50_000_000, // gas_budget
            Some(gas_price),
        )
        .await
        .map_err(|e| format!("Failed to build transaction data: {}", e))?;

    // Sign using keystore
    let signature = keystore
        .sign_secure(&sender, &tx_data, Intent::sui_transaction())
        .await
        .map_err(|e| format!("Failed to sign transaction: {}", e))?;

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
        .map_err(|e| format!("Failed to execute transaction: {}", e))?;

    Ok(response.digest.to_string())
}
