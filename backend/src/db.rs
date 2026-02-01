use crate::entities::{category, contract, favorite, market_history};
use sea_orm::{
    ActiveModelTrait, ConnectionTrait, Database, DatabaseConnection, DbBackend, EntityTrait,
    PaginatorTrait, Schema, Set,
};

pub async fn init_db(db_url: &str) -> Result<DatabaseConnection, Box<dyn std::error::Error>> {
    let db: DatabaseConnection = Database::connect(db_url).await?;

    // Create table if not exists (Basic automatic migration for this simple use case)
    let schema = Schema::new(DbBackend::Sqlite);
    let create_table_contract = schema
        .create_table_from_entity(contract::Entity)
        .if_not_exists()
        .to_owned();
    let create_table_history = schema
        .create_table_from_entity(market_history::Entity)
        .if_not_exists()
        .to_owned();
    let create_table_category = schema
        .create_table_from_entity(category::Entity)
        .if_not_exists()
        .to_owned();
    let create_table_favorite = schema
        .create_table_from_entity(favorite::Entity)
        .if_not_exists()
        .to_owned();

    let builder = db.get_database_backend();

    db.execute(builder.build(&create_table_category)).await?;
    db.execute(builder.build(&create_table_contract)).await?;
    db.execute(builder.build(&create_table_history)).await?;
    db.execute(builder.build(&create_table_favorite)).await?;

    // Migration: Add new columns if they don't exist
    // Check if the columns exist or simply try adding them (SQLite ignores if exists in some modes, but safer to catch error)
    // For simplicity in this dev environment, we just try to add them and ignore errors
    let _ = db
        .execute(sea_orm::Statement::from_string(
            DbBackend::Sqlite,
            "ALTER TABLE contracts ADD COLUMN total_volume REAL DEFAULT 0;",
        ))
        .await;

    let _ = db
        .execute(sea_orm::Statement::from_string(
            DbBackend::Sqlite,
            "ALTER TABLE contracts ADD COLUMN outcome_odds TEXT;",
        ))
        .await;

    let _ = db
        .execute(sea_orm::Statement::from_string(
            DbBackend::Sqlite,
            "ALTER TABLE market_history ADD COLUMN total_volume REAL DEFAULT 0;",
        ))
        .await;

    // Seed Categories
    seed_categories(&db).await?;

    Ok(db)
}

async fn seed_categories(db: &DatabaseConnection) -> Result<(), Box<dyn std::error::Error>> {
    let count = category::Entity::find().count(db).await?;
    if count == 0 {
        let categories = vec![
            ("All", "LayoutGrid"),
            ("New", "Sparkles"),
            ("Sports", "Trophy"),
            ("Politics", "Landmark"),
            ("Crypto", "Bitcoin"),
            ("Business", "Briefcase"),
            ("Science", "FlaskConical"),
        ];

        for (name, icon) in categories {
            category::ActiveModel {
                name: Set(name.to_string()),
                icon: Set(Some(icon.to_string())),
                ..Default::default()
            }
            .insert(db)
            .await?;
        }
        println!("Seeded default categories.");
    }
    Ok(())
}
