use crate::entities::contract;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use serde::Deserialize;

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

async fn create_market_on_chain(
    question: &str,
    options_count: u8,
) -> Result<String, Box<dyn std::error::Error>> {
    println!(
        "Creating market on chain... Question: {}, Options: {}",
        question, options_count
    );

    let fake_id = format!("0x{:064x}", rand::random::<u128>());
    println!(
        "(SIMULATION) Market would be created. Returning fake ID: {}",
        fake_id
    );

    // Simulate network delay
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    Ok(fake_id)
}
