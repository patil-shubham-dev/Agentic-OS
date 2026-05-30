# Provider Setup

## Overview

AgenticOS supports 17 AI providers. You need at least one configured provider to use the AI assistant.

## Adding a Provider

1. Open **Settings → Providers**
2. Click **Add Provider**
3. Select a provider from the preset list or enter a custom URL
4. Enter your API key (if required)
5. Click **Test Connection** to verify
6. Assign the provider to agent roles in **Settings → Roles**

## Supported Providers

### Cloud Providers

| Provider | Base URL | API Key Required | Notes |
|----------|----------|-----------------|-------|
| **OpenAI** | `https://api.openai.com/v1` | Yes | GPT-4o, GPT-4, GPT-3.5 |
| **Anthropic** | `https://api.anthropic.com/v1` | Yes | Claude 3.5, Claude 3 |
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta` | Yes | Gemini 1.5 Pro, Flash |
| **Groq** | `https://api.groq.com/openai/v1` | Yes | Fast inference |
| **OpenRouter** | `https://openrouter.ai/api/v1` | Yes | Multi-model access |
| **NVIDIA NIM** | `https://api.nvidia.com/v1` | Yes | NVIDIA models |
| **DeepSeek** | `https://api.deepseek.com/v1` | Yes | DeepSeek models |
| **Together AI** | `https://api.together.xyz/v1` | Yes | Open-source models |
| **Azure OpenAI** | `https://{resource}.openai.azure.com` | Yes | Enterprise |

### Local Providers

| Provider | Default URL | API Key | Notes |
|----------|-----------|---------|-------|
| **Ollama** | `http://localhost:11434` | No | Run models locally |
| **vLLM** | `http://localhost:8000` | Optional | High-throughput serving |
| **LM Studio** | `http://localhost:1234` | No | Local model runner |
| **LocalAI** | `http://localhost:8080` | No | Self-hosted API |
| **LiteLLM** | `http://localhost:4000` | Optional | Multi-provider proxy |

### Custom

| Provider | Notes |
|----------|-------|
| **OpenAI-Compatible** | Any API that follows the OpenAI chat completions format |

## API Keys

Store API keys securely. The app persists them in:
- Windows: Encrypted local storage
- Environment variables can also be used

## Model Discovery

When you add a provider with a valid connection, AgenticOS automatically:
1. Pings the models endpoint
2. Discovers available models
3. Populates model selection dropdowns

## Provider → Role Assignment

1. Open **Settings → Roles**
2. For each agent role (manager, coder, researcher, etc.):
   - Select a provider
   - Select a model
   - Configure token limits

## Testing Your Setup

After configuration:
1. Type a simple message in chat: "Hello, what can you do?"
2. Verify the response streams in real-time
3. Check that the provider name appears in the execution header

## Common Issues

- **Connection refused**: Ensure the provider URL is correct and accessible
- **401 Unauthorized**: Check your API key
- **No models found**: The provider may use a different models endpoint
- **Stream not working**: Some providers require specific configuration for streaming

See `docs/TROUBLESHOOTING.md` for more.
