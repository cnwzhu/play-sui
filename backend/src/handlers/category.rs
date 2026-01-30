use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use sea_orm::{
    DatabaseConnection, EntityTrait,
};
use crate::entities::category;

pub async fn list_categories(
    State(db): State<DatabaseConnection>,
) -> Result<Json<Vec<category::Model>>, (StatusCode, String)> {
    let categories = category::Entity::find()
        .all(&db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(categories))
}
