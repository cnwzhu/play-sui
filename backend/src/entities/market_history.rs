use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "market_history")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub contract_id: i32,
    pub timestamp: String, // storing as ISO string for simplicity in SQLite
    pub option_prices: String, // JSON string: [0.5, 0.5] or {"Yes": 0.5, "No": 0.5}
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::contract::Entity",
        from = "Column::ContractId",
        to = "super::contract::Column::Id"
    )]
    Contract,
}

impl Related<super::contract::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Contract.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
