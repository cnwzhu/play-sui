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
        .route("/categories", get(handlers::category::list_categories))
        .route("/oracle/resolve", axum::routing::post(handlers::oracle::resolve_market))
        .layer(CorsLayer::permissive())
        .with_state(db);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("listening on {}", addr);
    
    axum::serve(tokio::net::TcpListener::bind(addr).await?, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}