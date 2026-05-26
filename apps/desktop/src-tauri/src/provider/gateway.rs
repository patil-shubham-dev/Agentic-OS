use crate::provider::detection;
use crate::provider::models::*;
use futures_util::StreamExt;
use std::collections::HashMap;
use tauri::AppHandle;
use tauri::Emitter;

async fn send_openai_chat(
    base_url: &str,
    api_key: &str,
    req: &ChatRequest,
) -> Result<ChatResponse, String> {
    let endpoint = format!("{}/chat/completions", base_url.trim_end_matches('/'));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    let mut body_map = serde_json::Map::new();
    body_map.insert("model".to_string(), serde_json::Value::String(req.model.clone()));
    body_map.insert("stream".to_string(), serde_json::Value::Bool(false));

    let messages: Vec<serde_json::Value> = req
        .messages
        .iter()
        .map(|m| {
            let mut msg = serde_json::Map::new();
            msg.insert("role".to_string(), serde_json::Value::String(m.role.clone()));
            msg.insert("content".to_string(), serde_json::Value::String(m.content.clone()));
            if let Some(tcs) = &m.tool_calls {
                let tcs_val: Vec<serde_json::Value> = tcs
                    .iter()
                    .map(|tc| {
                        serde_json::json!({
                            "id": tc.id,
                            "type": tc.tool_type,
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments
                            }
                        })
                    })
                    .collect();
                msg.insert("tool_calls".to_string(), serde_json::Value::Array(tcs_val));
            }
            if let Some(tcid) = &m.tool_call_id {
                msg.insert(
                    "tool_call_id".to_string(),
                    serde_json::Value::String(tcid.clone()),
                );
            }
            serde_json::Value::Object(msg)
        })
        .collect();
    if let Some(max_tokens) = &req.max_tokens {
        body_map.insert("max_tokens".to_string(), serde_json::json!(max_tokens));
    }
    if let Some(temperature) = &req.temperature {
        body_map.insert("temperature".to_string(), serde_json::json!(temperature));
    }
    body_map.insert("messages".to_string(), serde_json::Value::Array(messages));

    if let Some(tools) = &req.tools {
        let tools_val: Vec<serde_json::Value> = tools
            .iter()
            .map(|t| {
                serde_json::json!({
                    "type": t.tool_type,
                    "function": {
                        "name": t.function.name,
                        "description": t.function.description,
                        "parameters": t.function.parameters
                    }
                })
            })
            .collect();
        body_map.insert("tools".to_string(), serde_json::Value::Array(tools_val));
        body_map.insert("tool_choice".to_string(), serde_json::Value::String("auto".to_string()));
    }

    let auth_value = if api_key.trim().starts_with("Bearer ") {
        api_key.trim().to_string()
    } else {
        format!("Bearer {}", api_key.trim())
    };

    let resp = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .header("Authorization", auth_value)
        .json(&body_map)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", status.as_u16(), text));
    }

    let content_type = resp.headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if content_type.contains("text/event-stream") {
        return Err(
            "Provider returned a stream instead of JSON. \
             This usually means stream:true was sent accidentally. \
             Check your provider configuration.".to_string()
        );
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let choice = data["choices"][0]
        .as_object()
        .ok_or_else(|| "No choices in response".to_string())?;

    let msg_obj = choice["message"]
        .as_object()
        .ok_or_else(|| "No message in choice".to_string())?;

    let message = ChatMessage {
        role: msg_obj
            .get("role")
            .and_then(|v| v.as_str())
            .unwrap_or("assistant")
            .to_string(),
        content: msg_obj
            .get("content")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        tool_calls: msg_obj.get("tool_calls").and_then(|tc| {
            tc.as_array().map(|arr| {
                arr.iter()
                    .filter_map(|t| {
                        Some(ToolCall {
                            id: t["id"].as_str()?.to_string(),
                            tool_type: t["type"].as_str()?.to_string(),
                            function: ToolFunction {
                                name: t["function"]["name"].as_str()?.to_string(),
                                arguments: t["function"]["arguments"].as_str()?.to_string(),
                            },
                        })
                    })
                    .collect()
            })
        }),
        tool_call_id: None,
    };

    let usage = data.get("usage").map(|u| UsageInfo {
        prompt_tokens: u["prompt_tokens"].as_u64().unwrap_or(0) as u32,
        completion_tokens: u["completion_tokens"].as_u64().unwrap_or(0) as u32,
        total_tokens: u["total_tokens"].as_u64().unwrap_or(0) as u32,
    });

    Ok(ChatResponse {
        message,
        finish_reason: choice["finish_reason"].as_str().map(|s| s.to_string()),
        usage,
    })
}

async fn send_anthropic_chat(
    base_url: &str,
    api_key: &str,
    req: &ChatRequest,
) -> Result<ChatResponse, String> {
    let endpoint = format!("{}/v1/messages", base_url.trim_end_matches('/'));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    let anthropic_messages: Vec<serde_json::Value> = req
        .messages
        .iter()
        .filter(|m| m.role != "system")
        .map(|m| {
            serde_json::json!({
                "role": m.role,
                "content": m.content
            })
        })
        .collect();

    let system = req
        .messages
        .iter()
        .find(|m| m.role == "system")
        .map(|m| m.content.as_str())
        .unwrap_or("");

    let mut body_map = serde_json::Map::new();
    body_map.insert("model".to_string(), serde_json::Value::String(req.model.clone()));
    body_map.insert(
        "messages".to_string(),
        serde_json::Value::Array(anthropic_messages),
    );
    if let Some(max_tokens) = &req.max_tokens {
        body_map.insert("max_tokens".to_string(), serde_json::json!(max_tokens));
    } else {
        body_map.insert("max_tokens".to_string(), serde_json::json!(4096));
    }
    if let Some(temperature) = &req.temperature {
        body_map.insert("temperature".to_string(), serde_json::json!(temperature));
    }
    if !system.is_empty() {
        body_map.insert("system".to_string(), serde_json::Value::String(system.to_string()));
    }

    let resp = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body_map)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Anthropic API error {}: {}", status.as_u16(), text));
    }

    let content_type = resp.headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if content_type.contains("text/event-stream") {
        return Err(
            "Anthropic returned a stream instead of JSON. \
             This usually means stream:true was sent accidentally. \
             Check your provider configuration.".to_string()
        );
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Anthropic response: {}", e))?;

    let content_blocks = data["content"]
        .as_array()
        .ok_or_else(|| "No content in response".to_string())?;

    let text_content: String = content_blocks
        .iter()
        .filter_map(|b| b["text"].as_str())
        .collect::<Vec<_>>()
        .join("");

    let (input_tokens, output_tokens) = (
        data["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32,
        data["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32,
    );

    Ok(ChatResponse {
        message: ChatMessage {
            role: "assistant".to_string(),
            content: text_content,
            tool_calls: None,
            tool_call_id: None,
        },
        finish_reason: data["stop_reason"].as_str().map(|s| s.to_string()),
        usage: Some(UsageInfo {
            prompt_tokens: input_tokens,
            completion_tokens: output_tokens,
            total_tokens: input_tokens + output_tokens,
        }),
    })
}

pub async fn chat_completion(
    base_url: &str,
    api_key: &str,
    runtime: Option<&str>,
    req: &ChatRequest,
) -> Result<ChatResponse, String> {
    match runtime {
        Some("Anthropic") => send_anthropic_chat(base_url, api_key, req).await,
        _ => send_openai_chat(base_url, api_key, req).await,
    }
}

pub async fn validate_connection(base_url: &str, api_key: &str) -> crate::provider::models::ValidationResult {
    let start = std::time::Instant::now();
    let info = detection::detect_runtime(base_url);
    let endpoint = detection::model_discovery_endpoint(base_url, info.runtime.as_deref());

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return crate::provider::models::ValidationResult {
                success: false,
                runtime: info.runtime,
                latency_ms: start.elapsed().as_millis() as u64,
                error: Some(format!("Client error: {}", e)),
            }
        }
    };

    let mut req_builder = client.get(&endpoint);
    if !api_key.is_empty() {
        let auth_value = if api_key.trim().starts_with("Bearer ") {
            api_key.trim().to_string()
        } else {
            format!("Bearer {}", api_key.trim())
        };
        req_builder = req_builder.header("Authorization", auth_value);
    }

    match req_builder.send().await {
        Ok(resp) => {
            let latency = start.elapsed().as_millis() as u64;
            if resp.status().is_success() {
                crate::provider::models::ValidationResult {
                    success: true,
                    runtime: info.runtime,
                    latency_ms: latency,
                    error: None,
                }
            } else {
                let err = match resp.status().as_u16() {
                    401 => "Invalid API key".to_string(),
                    404 => "Endpoint not found".to_string(),
                    s => format!("HTTP {}", s),
                };
                crate::provider::models::ValidationResult {
                    success: false,
                    runtime: info.runtime,
                    latency_ms: latency,
                    error: Some(err),
                }
            }
        }
        Err(e) => {
            let latency = start.elapsed().as_millis() as u64;
            let err = if e.is_timeout() {
                "Connection timed out".to_string()
            } else if e.is_connect() {
                format!("Connection refused: {}", e)
            } else {
                format!("Request failed: {}", e)
            };
            crate::provider::models::ValidationResult {
                success: false,
                runtime: info.runtime,
                latency_ms: latency,
                error: Some(err),
            }
        }
    }
}

#[tauri::command]
pub async fn test_provider_connection(
    endpoint: String,
    api_key: String,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Client build failed: {}", e))?;

    let models_url = format!("{}/models", endpoint.trim_end_matches('/'));

    let auth_value = if api_key.trim().starts_with("Bearer ") {
        api_key.trim().to_string()
    } else {
        format!("Bearer {}", api_key.trim())
    };

    let resp = client
        .get(&models_url)
        .header("Authorization", auth_value)
        .send()
        .await
        .map_err(|e| {
            let msg = e.to_string();
            let kind = e.without_url();
            format!("Connection failed: {} — kind: {:?}", msg, kind)
        })?;

    let status = resp.status();
    let content_type = resp.headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("(none)")
        .to_string();

    let body_preview = if status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        text.chars().take(500).collect::<String>()
    } else {
        let text = resp.text().await.unwrap_or_default();
        format!("HTTP {} — {}", status.as_u16(), text.chars().take(300).collect::<String>())
    };

    Ok(format!(
        "URL: {}\nStatus: {}\nContent-Type: {}\nBody preview:\n{}",
        models_url, status, content_type, body_preview
    ))
}

#[tauri::command]
pub async fn stream_openai_chat(
    endpoint: String,
    api_key: String,
    model: String,
    messages: Vec<serde_json::Value>,
    tools: Option<Vec<serde_json::Value>>,
    app: AppHandle,
    stream_id: String,
) -> Result<(), String> {
    if api_key.trim().is_empty() {
        return Err("API key is empty — check provider settings".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    let mut body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": true
    });

    if let Some(t) = tools {
        if !t.is_empty() {
            body["tools"] = serde_json::json!(t);
        }
    }

    let auth_value = if api_key.trim().starts_with("Bearer ") {
        api_key.trim().to_string()
    } else {
        format!("Bearer {}", api_key.trim())
    };

    let resp = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .header("Authorization", auth_value)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body_text = resp.text().await.unwrap_or_default();
        return Err(format!("Provider error {}: {}", status, body_text));
    }

    let mut tool_call_buffer: HashMap<u64, serde_json::Value> = HashMap::new();

    let mut stream = resp.bytes_stream();
    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);

        for line in text.lines() {
            if line.starts_with("data: ") {
                let data = &line[6..];
                if data == "[DONE]" {
                    if !tool_call_buffer.is_empty() {
                        let tool_calls: Vec<serde_json::Value> = {
                            let mut pairs: Vec<(u64, serde_json::Value)> =
                                tool_call_buffer.drain().collect();
                            pairs.sort_by_key(|(k, _)| *k);
                            pairs.into_iter().map(|(_, v)| v).collect()
                        };
                        let _ = app.emit(
                            &format!("stream-tool-calls-{}", stream_id),
                            serde_json::json!({ "tool_calls": tool_calls }),
                        );
                    }
                    let _ = app.emit(
                        &format!("stream-done-{}", stream_id),
                        serde_json::json!({ "done": true }),
                    );
                    return Ok(());
                }

                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    let delta = &parsed["choices"][0]["delta"];

                    if let Some(content) = delta["content"].as_str() {
                        if !content.is_empty() {
                            let _ = app.emit(
                                &format!("stream-token-{}", stream_id),
                                serde_json::json!({ "token": content }),
                            );
                        }
                    }

                    if let Some(tc_deltas) = delta["tool_calls"].as_array() {
                        for tc_delta in tc_deltas {
                            let index = tc_delta["index"].as_u64().unwrap_or(0);
                            let entry = tool_call_buffer
                                .entry(index)
                                .or_insert_with(|| serde_json::json!({
                                    "id": "",
                                    "type": "function",
                                    "function": { "name": "", "arguments": "" }
                                }));

                            if let Some(id) = tc_delta["id"].as_str() {
                                if !id.is_empty() {
                                    entry["id"] = serde_json::json!(id);
                                }
                            }
                            if let Some(name) = tc_delta["function"]["name"].as_str() {
                                if !name.is_empty() {
                                    entry["function"]["name"] = serde_json::json!(name);
                                }
                            }
                            if let Some(args) = tc_delta["function"]["arguments"].as_str() {
                                let current = entry["function"]["arguments"]
                                    .as_str()
                                    .unwrap_or("")
                                    .to_string();
                                entry["function"]["arguments"] =
                                    serde_json::json!(format!("{}{}", current, args));
                            }
                        }
                    }

                    if parsed["choices"][0]["finish_reason"].as_str() == Some("tool_calls") {
                        if !tool_call_buffer.is_empty() {
                            let tool_calls: Vec<serde_json::Value> = {
                                let mut pairs: Vec<(u64, serde_json::Value)> =
                                    tool_call_buffer.drain().collect();
                                pairs.sort_by_key(|(k, _)| *k);
                                pairs.into_iter().map(|(_, v)| v).collect()
                            };
                            let _ = app.emit(
                                &format!("stream-tool-calls-{}", stream_id),
                                serde_json::json!({ "tool_calls": tool_calls }),
                            );
                        }
                    }
                }
            }
        }
    }

    let _ = app.emit(
        &format!("stream-done-{}", stream_id),
        serde_json::json!({ "done": true }),
    );
    Ok(())
}
