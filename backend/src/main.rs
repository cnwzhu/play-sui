use axum::{
    routing::{delete, get},
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;

mod cron;
mod db;
mod entities;
mod handlers;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    // Database setup
    let db_url = "sqlite://contracts.db?mode=rwc";
    let db = db::init_db(db_url).await?;

    // Channel for instant indexer triggers
    let (tx, rx) = tokio::sync::mpsc::channel::<()>(100);

    // Start Indexer
    let db_clone = db.clone();
    tokio::spawn(async move {
        cron::indexer::run_indexer(db_clone, rx).await;
    });

    // App state
    let app = Router::new()
        .route(
            "/contracts",
            get(handlers::contract::list_contracts).post(handlers::contract::create_contract),
        )
        .route(
            "/contracts/{id}",
            delete(handlers::contract::delete_contract),
        )
        .route(
            "/contracts/{id}/history",
            get(handlers::market_history::get_contract_history),
        )
        .route("/categories", get(handlers::category::list_categories))
        .route(
            "/oracle/resolve",
            axum::routing::post(handlers::oracle::resolve_market),
        )
        .route(
            "/favorites",
            axum::routing::post(handlers::favorite::add_favorite)
                .delete(handlers::favorite::remove_favorite),
        )
        .route(
            "/favorites/{wallet}",
            get(handlers::favorite::get_favorites),
        )
        .layer(CorsLayer::permissive())
        .with_state(db)
        .layer(axum::Extension(tx));

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
