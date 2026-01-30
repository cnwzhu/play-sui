use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use sea_orm::{
    ActiveModelTrait, DatabaseConnection, EntityTrait, QueryFilter, ColumnTrait, Set,
};
use crate::entities::market_history;
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
         let mut mock_data = Vec::new();
         let mut active_models = Vec::new();

         {
             let mut rng = rand::thread_rng();
             let now = SystemTime::now();
             let mut current_price = 0.5;
             
             for i in (0..30).rev() {
                 let drift: f64 = rng.gen_range(-0.05..0.05);
                 current_price = (current_price + drift).clamp(0.05_f64, 0.95_f64);
                 
                 // Calculate time: i days ago
                 let time = now - std::time::Duration::from_secs(i * 24 * 3600);
                 let datetime: DateTime<Utc> = time.into();
                 
                 let point = market_history::ActiveModel {
                     contract_id: Set(contract_id),
                     timestamp: Set(datetime.to_rfc3339()),
                     yes_price: Set(current_price),
                     ..Default::default()
                 };
                 active_models.push(point);
             }
         }

         if !active_models.is_empty() {
            // Using insert_many would be efficient but let's stick to loop for simple response construction
            // or just use insert_many and then Convert back to Model. 
            // For simplicity and to match return type, we can just insert one by one or fetch again.
            // Let's iterate and insert.
            
            for point in active_models {
                let saved = point.insert(&db).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
                mock_data.push(saved);
            }
         }
         
         return Ok(Json(mock_data));
    }

    Ok(Json(history))
}
