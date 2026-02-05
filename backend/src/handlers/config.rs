use axum::{
    http::header,
    response::{IntoResponse, Response},
};
use std::env;

pub async fn get_config() -> impl IntoResponse {
    let package_id = env::var("VITE_PACKAGE_ID").unwrap_or_default();
    let sui_network = env::var("VITE_SUI_NETWORK").unwrap_or_default();
    let platform_admin = env::var("VITE_PLATFORM_ADMIN_ADDRESS").unwrap_or_default();

    let js_content = format!(
        r#"window.env = {{
    VITE_PACKAGE_ID: "{}",
    VITE_SUI_NETWORK: "{}",
    VITE_PLATFORM_ADMIN_ADDRESS: "{}"
}};"#,
        package_id, sui_network, platform_admin
    );

    Response::builder()
        .header(header::CONTENT_TYPE, "application/javascript")
        .body(js_content)
        .unwrap()
}
