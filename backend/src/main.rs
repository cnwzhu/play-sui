use axum::{
    routing::{get, delete},
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;

mod entities;
mod handlers;
mod db;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    
    // Database setup
    let db_url = "sqlite://contracts.db?mode=rwc";
    let db = db::init_db(db_url).await?;

    // App state
    let app = Router::new()
        .route("/contracts", get(handlers::contract::list_contracts).post(handlers::contract::create_contract))
        .route("/contracts/{id}", delete(handlers::contract::delete_contract))
        .route("/contracts/{id}/history", get(handlers::market_history::get_contract_history))
        .route("/oracle/resolve", axum::routing::post(handlers::oracle::resolve_market))
        .layer(CorsLayer::permissive())
        .with_state(db);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("listening on {}", addr);
    axum::serve(tokio::net::TcpListener::bind(addr).await?, app).await?;

    Ok(())
}
