use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use sea_orm::{
    ActiveModelTrait, DatabaseConnection, EntityTrait, QueryFilter, ColumnTrait, Set,
};
use crate::entities::{market_history, contract};
// use serde::Deserialize; // Remove if unused
use std::time::SystemTime;
use chrono::{DateTime, Utc};
use rand::Rng; 

pub async fn get_contract_history(
    State(db): State<DatabaseConnection>,
    Path(contract_id): Path<i32>,
) -> Result<Json<Vec<market_history::Model>>, (StatusCode, String)> {
    let history = market_history::Entity::find()
        .filter(market_history::Column::ContractId.eq(contract_id))
        .all(&db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // If history is empty, let's generate some mock data for visualization
    if history.is_empty() {
         // 1. Fetch contract to determine number of options
         let contract_model = contract::Entity::find_by_id(contract_id)
            .one(&db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
            .ok_or((StatusCode::NOT_FOUND, "Contract not found".to_string()))?;

         let options_count = contract_model.options
            .and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok())
            .map(|v| v.len())
            .unwrap_or(2);

         let mut mock_data = Vec::new();
         let mut active_models = Vec::new();

         {
             let mut rng = rand::thread_rng();
             let now = SystemTime::now();
             
             // Initialize current prices for each option evenly
             let mut current_prices: Vec<f64> = vec![1.0 / (options_count as f64); options_count];
             
             for i in (0..30).rev() {
                 // Drift each price slightly
                 let mut sum = 0.0;
                 for p in &mut current_prices {
                     let drift: f64 = rng.gen_range(-0.05..0.05);
                     *p = (*p + drift).clamp(0.01, 0.99);
                     sum += *p;
                 }
                 
                 // Normalize so they sum to 1.0
                 for p in &mut current_prices {
                     *p /= sum;
                 }
                 
                 // Calculate time: i days ago
                 let time = now - std::time::Duration::from_secs(i * 24 * 3600);
                 let datetime: DateTime<Utc> = time.into();
                 
                 let point = market_history::ActiveModel {
                     contract_id: Set(contract_id),
                     timestamp: Set(datetime.to_rfc3339()),
                     option_prices: Set(serde_json::to_string(&current_prices).unwrap()),
                     ..Default::default()
                 };
                 active_models.push(point);
             }
         }

         if !active_models.is_empty() {
            for point in active_models {
                let saved = point.insert(&db).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
                mock_data.push(saved);
            }
         }
         
         return Ok(Json(mock_data));
    }

    Ok(Json(history))
}