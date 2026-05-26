use crate::provider::detection;
use crate::provider::discovery;
use crate::provider::gateway;
use crate::provider::models::*;
use tauri::command;

#[command]
pub fn detect_runtime(base_url: String) -> detection::RuntimeInfo {
    detection::detect_runtime(&base_url)
}

#[command]
pub async fn validate_provider(base_url: String, api_key: String) -> ValidationResult {
    gateway::validate_connection(&base_url, &api_key).await
}

#[command]
pub async fn discover_models(base_url: String, api_key: String) -> DiscoveryResult {
    discovery::discover_models(&base_url, &api_key).await
}

#[command]
pub async fn provider_chat_completion(
    base_url: String,
    api_key: String,
    runtime: Option<String>,
    request: ChatRequest,
) -> Result<ChatResponse, String> {
    gateway::chat_completion(&base_url, &api_key, runtime.as_deref(), &request).await
}
