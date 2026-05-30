# Troubleshooting

## Connection Issues

### Provider Connection Failed
- Verify the base URL is correct
- Check that your API key is valid and has credits
- Test the connection in **Settings → Providers**

### "Provider returned 401"
- Your API key is invalid or expired
- Generate a new key and update in settings

### "Stream interrupted"
- Network connection may be unstable
- The provider may have timed out
- Try again — if persistent, switch providers

## Setup Issues

### App doesn't start
- Ensure Node.js >= 18 is installed
- Run `npm install` to ensure all dependencies are installed
- Check console for error messages

### Web version shows blank screen
- Open browser developer console (F12) for errors
- Try a different browser (Chrome/Firefox/Edge)
- Clear browser cache and reload

### Tauri build fails
- Ensure Rust is installed: `rustc --version`
- Install Tauri prerequisites for your OS
- Check `src-tauri/Cargo.toml` for correct dependencies

## Runtime Issues

### Agent not responding
- Check that a provider is configured and assigned to a role
- Verify provider has available quota
- Check the execution dock for error messages

### Streaming is slow
- Some providers have slower streaming than others
- OpenRouter and Groq typically have faster time-to-first-token
- Check your network connection

### Tool execution fails
- File permissions: ensure the agent has write access to the workspace
- Command execution: some commands may require elevated privileges
- Browser tools: ensure the browser launches correctly

### Cancel button doesn't work
- This was a known issue fixed in Beta-1
- Ensure you're running the latest version

## Display Issues

### Code blocks not highlighting
- Rehype-highlight may not support the language
- The code block still renders with monospace formatting

### Terminal output not showing
- Command execution output appears in TerminalBlock components
- Live output shows during execution
- Scroll to the bottom of the terminal card

### Execution header missing
- The header shows provider, model, and duration
- Ensure the agent session was created (AGENT_ASSIGNED event)

## Provider-Specific Issues

### Ollama
- Ensure Ollama is running: `ollama serve`
- Pull the model: `ollama pull <model-name>`
- Default URL: `http://localhost:11434`

### Anthropic
- Requires a valid API key from console.anthropic.com
- Streaming uses the Messages API

### Google Gemini
- Uses a different API format
- API key from Google AI Studio
- Some features (tool calling) are limited

### OpenRouter
- Free tier has rate limits
- Check your credits at openrouter.ai

## Getting Help

- Check the logs: `Settings → Logs`
- Enable debug logging in developer tools
- Report issues at: https://github.com/anomalyco/opencode/issues
