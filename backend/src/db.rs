use sea_orm::{Database, DatabaseConnection, ConnectionTrait, Schema, DbBackend};
use crate::entities::{contract, market_history};

pub async fn init_db(db_url: &str) -> Result<DatabaseConnection, Box<dyn std::error::Error>> {
    let db: DatabaseConnection = Database::connect(db_url).await?;

    // Create table if not exists (Basic automatic migration for this simple use case)
    let schema = Schema::new(DbBackend::Sqlite);
    let create_table_contract = schema.create_table_from_entity(contract::Entity).if_not_exists().to_owned();
    let create_table_history = schema.create_table_from_entity(market_history::Entity).if_not_exists().to_owned();
    
    let builder = db.get_database_backend();
    
    let stmt_contract = builder.build(&create_table_contract);
    db.execute(stmt_contract).await?;
    
    let stmt_history = builder.build(&create_table_history);
    db.execute(stmt_history).await?;

    Ok(db)
}
