use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "categories")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    #[sea_orm(unique)]
    pub name: String,
    pub icon: Option<String>, // Stores icon name string for frontend lookup
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::contract::Entity")]
    Contract,
}

impl Related<super::contract::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Contract.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
