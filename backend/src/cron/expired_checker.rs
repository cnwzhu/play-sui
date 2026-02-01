//! Expired Markets Checker Cron Job
//! Periodically checks for markets past their end_date that haven't been resolved
//! and automatically cancels them (triggering refunds)

use crate::entities::contract;
use crate::handlers::cancel;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use std::time::Duration;
use tokio::time;

pub async fn run_expired_checker(db: DatabaseConnection) {
    println!("Starting Expired Markets Checker Task...");

    // Check every 30 seconds
    let mut interval = time::interval(Duration::from_secs(30));

    loop {
        interval.tick().await;

        // Find expired, unresolved markets
        let now = chrono::Utc::now();

        // Query contracts with end_date < now AND resolved = false
        let contracts = match contract::Entity::find()
            .filter(contract::Column::Resolved.eq(false))
            .all(&db)
            .await
        {
            Ok(c) => c,
            Err(e) => {
                eprintln!("ExpiredChecker: Failed to fetch contracts: {}", e);
                continue;
            }
        };

        for contract_model in contracts {
            // Skip if no end_date
            let end_date_str = match &contract_model.end_date {
                Some(d) => d,
                None => continue,
            };

            // Parse end_date
            let end_date = match chrono::DateTime::parse_from_rfc3339(end_date_str) {
                Ok(d) => d,
                Err(_) => {
                    // Try parsing as date only
                    match chrono::NaiveDate::parse_from_str(end_date_str, "%Y-%m-%d") {
                        Ok(d) => d.and_hms_opt(23, 59, 59).unwrap().and_utc().fixed_offset(),
                        Err(_) => continue,
                    }
                }
            };

            // Check if expired
            if now > end_date {
                println!(
                    "ExpiredChecker: Market {} ({}) has expired (end_date: {}), cancelling...",
                    contract_model.id, contract_model.name, end_date_str
                );

                // Call cancel internal function
                match cancel::execute_cancel_market(&contract_model.address).await {
                    Ok(digest) => {
                        println!(
                            "ExpiredChecker: Successfully cancelled market {} (Digest: {})",
                            contract_model.id, digest
                        );

                        // Optional: Mark as cancelled in DB immediately?
                        // The indexer will pick it up, but we could update here too.
                    }
                    Err(e) => {
                        eprintln!(
                            "ExpiredChecker: Failed to cancel market {}: {}",
                            contract_model.id, e
                        );
                    }
                }
            }
        }
    }
}
