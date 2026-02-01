use crate::entities::favorite;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct AddFavorite {
    pub wallet_address: String,
    pub contract_id: i32,
}

pub async fn add_favorite(
    State(db): State<DatabaseConnection>,
    Json(payload): Json<AddFavorite>,
) -> Result<Json<favorite::Model>, (StatusCode, String)> {
    // Check if already exists
    let exists = favorite::Entity::find()
        .filter(favorite::Column::WalletAddress.eq(&payload.wallet_address))
        .filter(favorite::Column::ContractId.eq(payload.contract_id))
        .one(&db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(fav) = exists {
        return Ok(Json(fav));
    }

    let new_favorite = favorite::ActiveModel {
        wallet_address: Set(payload.wallet_address),
        contract_id: Set(payload.contract_id),
        ..Default::default()
    };

    let saved = new_favorite
        .insert(&db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(saved))
}

pub async fn remove_favorite(
    State(db): State<DatabaseConnection>,
    Json(payload): Json<AddFavorite>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = favorite::Entity::delete_many()
        .filter(favorite::Column::WalletAddress.eq(&payload.wallet_address))
        .filter(favorite::Column::ContractId.eq(payload.contract_id))
        .exec(&db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected == 0 {
        // It's fine if it wasn't there, idempotent
        return Ok(StatusCode::NO_CONTENT);
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_favorites(
    State(db): State<DatabaseConnection>,
    Path(wallet_address): Path<String>,
) -> Result<Json<Vec<i32>>, (StatusCode, String)> {
    let favorites = favorite::Entity::find()
        .filter(favorite::Column::WalletAddress.eq(wallet_address))
        .all(&db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let ids = favorites.into_iter().map(|f| f.contract_id).collect();
    Ok(Json(ids))
}
