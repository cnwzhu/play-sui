use crate::entities::{contract, market_history};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use sea_orm::{DatabaseConnection, EntityTrait};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct HistoryParams {
    pub range: Option<String>,
}

pub async fn get_contract_history(
    State(db): State<DatabaseConnection>,
    Path(contract_id): Path<i32>,
    Query(params): Query<HistoryParams>,
) -> Result<Json<Vec<market_history::Model>>, (StatusCode, String)> {
    // 1. Fetch contract to determine number of options
    let contract_model = contract::Entity::find_by_id(contract_id)
        .one(&db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Contract not found".to_string()))?;

    let options_count = contract_model
        .options
        .and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok())
        .map(|v| v.len())
        .unwrap_or(2);

    let range = params.range.as_deref().unwrap_or("1M");

    // Query the database for real history
    use sea_orm::{ColumnTrait, QueryFilter, QueryOrder};

    // Calculate start time based on range
    let now = Utc::now();
    let duration = match range {
        "5m" => chrono::Duration::minutes(5),
        "1h" => chrono::Duration::hours(1),
        "6h" => chrono::Duration::hours(6),
        "1d" => chrono::Duration::days(1),
        "1w" => chrono::Duration::weeks(1),
        "1M" | _ => chrono::Duration::days(30),
    };
    let start_time = now - duration;

    let history = market_history::Entity::find()
        .filter(market_history::Column::ContractId.eq(contract_id))
        .filter(market_history::Column::Timestamp.gte(start_time.to_rfc3339()))
        .order_by_asc(market_history::Column::Timestamp)
        .all(&db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // If no history yet, return at least one initial point (equal probability) to prevent chart errors
    if history.is_empty() {
        let initial_prices = vec![1.0 / (options_count as f64); options_count];
        let price_json = serde_json::to_string(&initial_prices).unwrap();

        // Return two points to create a flat line across the chart
        return Ok(Json(vec![
            market_history::Model {
                id: 0,
                contract_id,
                timestamp: start_time.to_rfc3339(),
                option_prices: price_json.clone(),
                total_volume: 0.0,
            },
            market_history::Model {
                id: 0, // ID doesn't matter for frontend display
                contract_id,
                timestamp: now.to_rfc3339(),
                option_prices: price_json,
                total_volume: 0.0,
            },
        ]));
    }

    Ok(Json(history))
}
