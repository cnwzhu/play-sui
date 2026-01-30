use axum::{
    extract::{Path, State, Query},
    http::StatusCode,
    Json,
};
use sea_orm::{
    DatabaseConnection, EntityTrait,
};
use crate::entities::{market_history, contract};
use serde::Deserialize;
use std::time::SystemTime;
use chrono::{DateTime, Utc};
use rand::Rng; 

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

    let options_count = contract_model.options
        .and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok())
        .map(|v| v.len())
        .unwrap_or(2);

    let range = params.range.as_deref().unwrap_or("1M");
    
    // Determine config based on range
    // (Total Points, Step in Seconds)
    let (total_points, step_seconds) = match range {
        "5m" => (60, 5),          // 5 minutes: 60 points * 5s
        "1h" => (60, 60),         // 1 hour: 60 points * 1m
        "6h" => (72, 300),        // 6 hours: 72 points * 5m
        "1d" => (96, 900),        // 1 day: 96 points * 15m
        "1w" => (84, 7200),       // 1 week: 84 points * 2h
        "1M" | _ => (30, 86400),  // 1 month: 30 points * 1d
    };

    let mut mock_data = Vec::new();

    {
        let mut rng = rand::thread_rng();
        let now = SystemTime::now();
        
        // Initialize current prices for each option evenly
        let mut current_prices: Vec<f64> = vec![1.0 / (options_count as f64); options_count];
        
        // Generate history going BACKWARDS from now
        for i in (0..total_points).rev() {
            // Drift each price slightly
            let mut sum = 0.0;
            for p in &mut current_prices {
                // Volatility depends on timeframe? Let's keep it simple.
                let drift: f64 = rng.gen_range(-0.02..0.02); 
                *p = (*p + drift).clamp(0.01, 0.99);
                sum += *p;
            }
            
            // Normalize so they sum to 1.0
            for p in &mut current_prices {
                *p /= sum;
            }
            
            // Calculate time: i steps ago
            let offset = std::time::Duration::from_secs(i as u64 * step_seconds);
            let time = now - offset;
            let datetime: DateTime<Utc> = time.into();
            
            // We use the Model struct directly for response (skipping DB persistence for this dynamic demo)
            let point = market_history::Model {
                id: i, // Dummy ID
                contract_id,
                timestamp: datetime.to_rfc3339(),
                option_prices: serde_json::to_string(&current_prices).unwrap(),
            };
            mock_data.push(point);
        }
    }
    
    // Reverse to chronological order (oldest first) if we pushed backwards? 
    // Wait, the loop `(0..total_points).rev()` goes 29, 28, ... 0.
    // So `time = now - 29 steps` (Oldest), `time = now - 0 steps` (Newest).
    // Yes, this naturally produces oldest first.
    
    Ok(Json(mock_data))
}
