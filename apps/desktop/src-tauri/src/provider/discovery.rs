use crate::provider::detection::{self, model_discovery_endpoint};
use crate::provider::models::{DiscoveryResult, ProviderModel};

fn normalize_model_id(raw: &str) -> String {
    raw.trim().to_string()
}

fn infer_supports_tools(model_id: &str) -> bool {
    let id = model_id.to_lowercase();
    !(id.contains("instruct") || id.contains("embed") || id.contains("dall-e")
        || id.contains("tts") || id.contains("whisper"))
}

fn infer_supports_vision(model_id: &str) -> bool {
    let id = model_id.to_lowercase();
    id.contains("vision")
        || id.contains("gemini")
        || id.contains("gpt-4o")
        || id.contains("claude-3")
        || id.contains("claude-4")
        || id.contains("reka")
        || id.contains("llava")
}

fn infer_context_window(model_id: &str) -> Option<u32> {
    let id = model_id.to_lowercase();
    if id.contains("claude") && (id.contains("sonnet") || id.contains("opus") || id.contains("haiku")) {
        return Some(200_000);
    }
    if id.contains("gemini") {
        return Some(1_048_576);
    }
    if id.contains("gpt-4o") || id.contains("gpt-4-turbo") {
        return Some(128_000);
    }
    if id.contains("gpt-4") && !id.contains("turbo") && !id.contains("mini") {
        return Some(8_192);
    }
    if id.contains("deepseek") {
        return Some(128_000);
    }
    if id.contains("llama-3") || id.contains("llama3") {
        return Some(8_192);
    }
    if id.contains("mixtral") || id.contains("mistral") {
        return Some(32_768);
    }
    None
}

fn model_from_id(raw_id: &str) -> ProviderModel {
    let id = normalize_model_id(raw_id);
    ProviderModel {
        id: id.clone(),
        name: id.clone(),
        context_window: infer_context_window(&id),
        supports_tools: infer_supports_tools(&id),
        supports_vision: infer_supports_vision(&id),
        supports_streaming: true,
    }
}

fn parse_openai_models_response(body: &str) -> Result<Vec<ProviderModel>, String> {
    let parsed: serde_json::Value =
        serde_json::from_str(body).map_err(|e| format!("Invalid JSON: {}", e))?;

    let models_array = parsed
        .get("data")
        .or_else(|| parsed.get("models"))
        .and_then(|v| v.as_array())
        .ok_or_else(|| "No models array found in response".to_string())?;

    let models: Vec<ProviderModel> = models_array
        .iter()
        .filter_map(|m| {
            let id = m
                .get("id")
                .or_else(|| m.get("name"))
                .or_else(|| m.get("model"))
                .and_then(|v| v.as_str())?;
            Some(model_from_id(id))
        })
        .collect();

    if models.is_empty() {
        return Err("No models discovered".to_string());
    }
    Ok(models)
}

fn parse_ollama_tags_response(body: &str) -> Result<Vec<ProviderModel>, String> {
    let parsed: serde_json::Value =
        serde_json::from_str(body).map_err(|e| format!("Invalid JSON: {}", e))?;

    let models_array = parsed
        .get("models")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "No models array found in Ollama response".to_string())?;

    let models: Vec<ProviderModel> = models_array
        .iter()
        .filter_map(|m| {
            let name = m.get("name").and_then(|v| v.as_str())?;
            let id = name.split(':').next().unwrap_or(name);
            Some(model_from_id(id))
        })
        .collect();

    if models.is_empty() {
        return Err("No models discovered from Ollama".to_string());
    }
    Ok(models)
}

pub async fn discover_models(base_url: &str, api_key: &str) -> DiscoveryResult {
    let runtime = detection::detect_runtime(base_url).runtime;
    let endpoint = model_discovery_endpoint(base_url, runtime.as_deref());

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e));

    let client = match client {
        Ok(c) => c,
        Err(e) => {
            return DiscoveryResult {
                success: false,
                models: vec![],
                error: Some(e),
            }
        }
    };

    let mut req = client.get(&endpoint);
    if !api_key.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", api_key));
    }

    let resp = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            return DiscoveryResult {
                success: false,
                models: vec![],
                error: Some(format!("Connection failed: {}", e)),
            }
        }
    };

    if !resp.status().is_success() {
        let status = resp.status();
        let err_msg = match status.as_u16() {
            401 => "Invalid API key".to_string(),
            404 => "Endpoint not found. Check the base URL.".to_string(),
            _ => format!("HTTP {}: {}", status.as_u16(), resp.text().await.unwrap_or_default()),
        };
        return DiscoveryResult {
            success: false,
            models: vec![],
            error: Some(err_msg),
        };
    }

    let body = match resp.text().await {
        Ok(b) => b,
        Err(e) => {
            return DiscoveryResult {
                success: false,
                models: vec![],
                error: Some(format!("Failed to read response body: {}", e)),
            }
        }
    };

    let result = match runtime.as_deref() {
        Some("Ollama") => parse_ollama_tags_response(&body),
        _ => parse_openai_models_response(&body),
    };

    match result {
        Ok(models) => DiscoveryResult {
            success: true,
            models,
            error: None,
        },
        Err(e) => DiscoveryResult {
            success: false,
            models: vec![],
            error: Some(e),
        },
    }
}
