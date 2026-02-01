use crate::entities::{contract, market_history};
use sea_orm::{
    ActiveModelTrait, ActiveValue, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait,
    QueryFilter,
};
use std::str::FromStr;
use std::time::Duration;
use sui_sdk::rpc_types::{EventFilter, SuiObjectDataOptions};
use sui_sdk::types::base_types::ObjectID;
use sui_sdk::SuiClientBuilder;
use tokio::time;

pub async fn run_indexer(db: DatabaseConnection, mut rx: tokio::sync::mpsc::Receiver<()>) {
    println!("Starting Indexer Task...");

    // Load PACKAGE_ID from environment variable (set by `just dev-run`)
    let package_id_str = match std::env::var("PACKAGE_ID") {
        Ok(id) => id,
        Err(_) => {
            eprintln!("PACKAGE_ID environment variable not set. Run with `just dev-run`.");
            return;
        }
    };
    println!("Indexer using PACKAGE_ID: {}", package_id_str);

    // Connect to Sui Mainnet (or Testnet based on env, currently hardcoded for demo)
    // Ideally this comes from ENV
    let sui_client = match SuiClientBuilder::default()
        .build("https://fullnode.testnet.sui.io:443")
        .await
    {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Failed to create Sui Client: {}", e);
            return;
        }
    };

    let mut interval = time::interval(Duration::from_secs(2));

    loop {
        // Wait for either timer or direct trigger
        tokio::select! {
            _ = interval.tick() => {},
            _ = rx.recv() => {
                println!("Indexer: Received instant trigger");
            }
        }

        // 1. Fetch active contracts from DB
        let contracts = match contract::Entity::find().all(&db).await {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Indexer: Failed to fetch contracts: {}", e);
                continue;
            }
        };

        for contract_model in contracts {
            // Skip if no on-chain ID (shouldn't happen for active markets)
            if contract_model.address.is_empty() {
                continue;
            }

            let object_id = match ObjectID::from_str(&contract_model.address) {
                Ok(id) => id,
                Err(_) => continue,
            };

            // Backfill check (if history was wiped but chain has data)
            backfill_history_if_needed(
                &db,
                &sui_client,
                &contract_model,
                object_id,
                &package_id_str,
            )
            .await;

            // 2. Fetch Object from Chain
            let object_read = match sui_client
                .read_api()
                .get_object_with_options(object_id, SuiObjectDataOptions::new().with_content())
                .await
            {
                Ok(res) => res,
                Err(e) => {
                    eprintln!("Indexer: Failed to read object {}: {}", object_id, e);
                    continue;
                }
            };

            if let Some(data) = object_read.data {
                if let Some(content) = data.content {
                    // 3. Parse Move Struct
                    // We need to extract `total_stakes` from the move struct fields
                    // The SDK returns a generic MoveStruct content
                    if let sui_sdk::rpc_types::SuiParsedData::MoveObject(parsed_obj) = content {
                        // We can try to deserialize the fields into our struct,
                        // or access them as JSON Value. Accessing as JSON is safer/easier here.
                        let fields_json =
                            serde_json::to_value(&parsed_obj.fields).unwrap_or_default();

                        let total_stakes_array =
                            fields_json.get("total_stakes").and_then(|v| v.as_array());

                        if let Some(stakes) = total_stakes_array {
                            let stakes_u64: Vec<u64> = stakes
                                .iter()
                                .map(|v| v.as_str().unwrap_or("0").parse::<u64>().unwrap_or(0))
                                .collect();

                            if stakes_u64.is_empty() {
                                continue;
                            }

                            let total_pool: u64 = stakes_u64.iter().sum();

                            // 4. Calculate Prices
                            // In pari-mutuel, Price = OutcomeStake / TotalStake (roughly, or inverse odds)
                            // Actually, if I bet on YES, my return is Total / YesPool.
                            // The "Implied Probability" (Price) is YesPool / Total.

                            let mut prices: Vec<f64> = Vec::new();
                            if total_pool == 0 {
                                // Equal probability if empty
                                let counts = stakes_u64.len();
                                prices = vec![1.0 / counts as f64; counts];
                            } else {
                                for s in &stakes_u64 {
                                    prices.push(*s as f64 / total_pool as f64);
                                }
                            }

                            // Calculate volume early for comparison
                            let volume_sui = total_pool as f64 / 1_000_000_000.0;

                            // 5. Save to DB
                            // Optimization: Check if latest history is same to avoid spamming DB
                            let should_insert = {
                                use sea_orm::{ColumnTrait, QueryFilter, QueryOrder};
                                let latest_history = market_history::Entity::find()
                                    .filter(
                                        market_history::Column::ContractId.eq(contract_model.id),
                                    )
                                    .order_by_desc(market_history::Column::Timestamp)
                                    .one(&db)
                                    .await
                                    .unwrap_or(None);

                                match latest_history {
                                    Some(last) => {
                                        // Compare prices using epsilon for float comparison
                                        // This fixes an issue where multi-class markets (3+ options)
                                        // would continuously insert data due to floating point precision
                                        // differences (e.g., 1/3 = 0.333... has precision issues)
                                        let last_prices: Vec<f64> =
                                            serde_json::from_str(&last.option_prices)
                                                .unwrap_or_default();

                                        // Use epsilon-based comparison for floats
                                        const EPSILON: f64 = 1e-9;

                                        let prices_changed = if last_prices.len() != prices.len() {
                                            true
                                        } else {
                                            last_prices
                                                .iter()
                                                .zip(prices.iter())
                                                .any(|(a, b)| (a - b).abs() > EPSILON)
                                        };

                                        let volume_changed =
                                            (last.total_volume - volume_sui).abs() > EPSILON;

                                        prices_changed || volume_changed
                                    }
                                    None => true, // No history, must insert
                                }
                            };

                            let json_prices = serde_json::to_string(&prices).unwrap_or_default();

                            if should_insert {
                                let now = chrono::Utc::now().to_rfc3339();

                                let new_history = market_history::ActiveModel {
                                    contract_id: ActiveValue::Set(contract_model.id),
                                    timestamp: ActiveValue::Set(now),
                                    option_prices: ActiveValue::Set(json_prices.clone()),
                                    total_volume: ActiveValue::Set(volume_sui),
                                    ..Default::default()
                                };

                                if let Err(e) =
                                    market_history::Entity::insert(new_history).exec(&db).await
                                {
                                    eprintln!("Indexer: Failed to insert history: {}", e);
                                } else {
                                    println!(
                                        "Indexer: Updated market {} prices",
                                        contract_model.id
                                    );
                                }
                            }

                            // 6. Update Contract Entity (Volume & Odds & Resolution Status)
                            // volume_sui is calculated above

                            // Extract resolved and winner from chain
                            let is_resolved = fields_json
                                .get("resolved")
                                .and_then(|v| v.as_bool())
                                .unwrap_or(false);

                            let winner_opt: Option<i32> = if is_resolved {
                                fields_json
                                    .get("winner")
                                    .and_then(|v| v.as_u64())
                                    .map(|w| w as i32)
                            } else {
                                None
                            };

                            let mut active_contract: contract::ActiveModel = contract_model.into();
                            active_contract.total_volume = ActiveValue::Set(volume_sui);
                            active_contract.outcome_odds = ActiveValue::Set(Some(json_prices));
                            active_contract.resolved = ActiveValue::Set(is_resolved);
                            active_contract.winner = ActiveValue::Set(winner_opt);

                            if let Err(e) = active_contract.update(&db).await {
                                eprintln!("Indexer: Failed to update contract details: {}", e);
                            }
                        }
                    }
                }
            }
        }
    }
}

async fn backfill_history_if_needed(
    db: &DatabaseConnection,
    sui_client: &sui_sdk::SuiClient,
    contract: &contract::Model,
    object_id: ObjectID,
    package_id_str: &str,
) {
    // Check if history empty
    let history_count = market_history::Entity::find()
        .filter(market_history::Column::ContractId.eq(contract.id))
        .count(db)
        .await
        .unwrap_or(0);

    if history_count > 0 {
        return;
    }

    println!("Indexer: Backfilling history for contract {}", contract.id);

    // Query Events via Module
    let query = EventFilter::MoveModule {
        package: ObjectID::from_str(package_id_str).unwrap_or(ObjectID::ZERO),
        module: "market".parse().unwrap(),
    };

    let mut cursor = None;

    loop {
        let events = match sui_client
            .event_api()
            .query_events(query.clone(), cursor, None, false) // false = ascending order (oldest first)
            .await
        {
            Ok(e) => e,
            Err(e) => {
                eprintln!("Indexer: Failed to query events: {}", e);
                break;
            }
        };

        if events.data.is_empty() {
            break;
        }

        println!(
            "Indexer: Found {} backfill events (page)",
            events.data.len()
        );

        for event in events.data {
            let event_type = event.type_.to_string();
            // println!("Debug Event: {} {:?}", event_type, event.parsed_json);

            // Handle MarketCreated
            if event_type.contains("::MarketCreated") {
                let valid_market =
                    if let Some(s) = event.parsed_json.get("id").and_then(|v| v.as_str()) {
                        ObjectID::from_str(s).unwrap_or(ObjectID::ZERO) == object_id
                    } else {
                        false
                    };

                if valid_market {
                    // Initial State: Volume 0, Equal Odds
                    // We can get options_count from event or contract model
                    let options_count = event
                        .parsed_json
                        .get("options_count")
                        .and_then(|v| v.as_u64())
                        .or_else(|| {
                            // fallback to contract model if parsing fails
                            contract
                                .options
                                .as_ref()
                                .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                                .map(|v| v.len() as u64)
                        })
                        .unwrap_or(2);

                    let prices = vec![1.0 / options_count as f64; options_count as usize];
                    let json_prices = serde_json::to_string(&prices).unwrap_or_default();

                    let ts = event.timestamp_ms.unwrap_or(0) as i64;
                    let dt = match chrono::DateTime::from_timestamp_millis(ts) {
                        Some(d) => d,
                        None => chrono::Utc::now(),
                    };

                    let new_history = market_history::ActiveModel {
                        contract_id: ActiveValue::Set(contract.id),
                        timestamp: ActiveValue::Set(dt.to_rfc3339()),
                        option_prices: ActiveValue::Set(json_prices),
                        total_volume: ActiveValue::Set(0.0),
                        ..Default::default()
                    };
                    let _ = market_history::Entity::insert(new_history).exec(db).await;
                }
            }
            // Handle BetPlaced
            else if event_type.contains("::BetPlaced") {
                let valid_market =
                    if let Some(s) = event.parsed_json.get("market_id").and_then(|v| v.as_str()) {
                        ObjectID::from_str(s).unwrap_or(ObjectID::ZERO) == object_id
                    } else {
                        false
                    };

                if valid_market {
                    let pool_amounts = event
                        .parsed_json
                        .get("pool_amounts")
                        .and_then(|v| v.as_array());

                    if let Some(stakes) = pool_amounts {
                        let stakes_u64: Vec<u64> = stakes
                            .iter()
                            .map(|v| v.as_str().unwrap_or("0").parse::<u64>().unwrap_or(0))
                            .collect();

                        let total_pool: u64 = stakes_u64.iter().sum();
                        let volume_sui = total_pool as f64 / 1_000_000_000.0;

                        let mut prices: Vec<f64> = Vec::new();
                        if total_pool == 0 {
                            let counts = stakes_u64.len();
                            prices = vec![1.0 / counts as f64; counts];
                        } else {
                            for s in &stakes_u64 {
                                prices.push(*s as f64 / total_pool as f64);
                            }
                        }
                        let json_prices = serde_json::to_string(&prices).unwrap_or_default();

                        let ts = event.timestamp_ms.unwrap_or(0) as i64;
                        let dt = match chrono::DateTime::from_timestamp_millis(ts) {
                            Some(d) => d,
                            None => chrono::Utc::now(),
                        };

                        let new_history = market_history::ActiveModel {
                            contract_id: ActiveValue::Set(contract.id),
                            timestamp: ActiveValue::Set(dt.to_rfc3339()),
                            option_prices: ActiveValue::Set(json_prices),
                            total_volume: ActiveValue::Set(volume_sui),
                            ..Default::default()
                        };
                        let _ = market_history::Entity::insert(new_history).exec(db).await;
                    } else {
                        eprintln!("Indexer: Warning - Missing 'pool_amounts' in BetPlaced event for market {}", object_id);
                    }
                }
            }
        }

        if events.has_next_page {
            cursor = events.next_cursor;
        } else {
            break;
        }
    }
}
