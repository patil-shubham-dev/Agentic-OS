use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct RuntimeInfo {
    pub runtime: Option<String>,
    pub is_openai_compatible: bool,
    pub is_local: bool,
}

pub fn detect_runtime(base_url: &str) -> RuntimeInfo {
    let u = base_url.to_lowercase();

    let runtime = if u.contains("openai.com") {
        Some("OpenAI".to_string())
    } else if u.contains("anthropic.com") {
        Some("Anthropic".to_string())
    } else if u.contains("generativelanguage.googleapis.com") {
        Some("Google Gemini".to_string())
    } else if u.contains("groq.com") {
        Some("Groq".to_string())
    } else if u.contains("openrouter.ai") {
        Some("OpenRouter".to_string())
    } else if u.contains("integrate.api.nvidia.com") || u.contains("nvcf.nvidia.com") {
        Some("Nvidia NIM".to_string())
    } else if u.contains("deepseek.com") {
        Some("DeepSeek".to_string())
    } else if u.contains("together.xyz") {
        Some("Together AI".to_string())
    } else if u.contains("azure.com") || u.contains("azure-api.net") {
        Some("Azure OpenAI".to_string())
    } else if u.contains("ollama") || u.contains("11434") {
        Some("Ollama".to_string())
    } else if u.contains("litellm") {
        Some("LiteLLM Gateway".to_string())
    } else if u.contains("lmstudio") {
        Some("LM Studio".to_string())
    } else if u.contains("vllm") {
        Some("vLLM".to_string())
    } else if u.contains("localhost") || u.contains("127.0.0.1") || u.contains("0.0.0.0") {
        Some("Localhost Runtime".to_string())
    } else {
        None
    };

    let is_openai_compatible = match &runtime {
        Some(r) => matches!(
            r.as_str(),
            "OpenAI" | "Groq" | "OpenRouter" | "Nvidia NIM" | "DeepSeek" | "Together AI" | "Ollama" | "LiteLLM Gateway" | "vLLM" | "LM Studio" | "Localhost Runtime"
        ),
        None => true,
    };

    let is_local = matches!(
        runtime.as_deref(),
        Some("Ollama" | "LM Studio" | "vLLM" | "Localhost Runtime")
    );

    RuntimeInfo {
        runtime,
        is_openai_compatible,
        is_local,
    }
}

pub fn model_discovery_endpoint(base_url: &str, runtime: Option<&str>) -> String {
    match runtime {
        Some("Ollama") => format!("{}/api/tags", base_url.trim_end_matches('/').trim_end_matches("/v1")),
        _ => format!("{}/models", base_url.trim_end_matches('/')),
    }
}

