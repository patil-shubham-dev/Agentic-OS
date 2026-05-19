# AgentOS Studio API Reference

## Base URL
```
http://localhost:8000/api
```

## Authentication
All endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### Health
```
GET /health
```
Returns service health status and integration connectivity.

### Chat

#### Non-streaming Chat
```
POST /chat
Content-Type: application/json

{
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "model": "gpt-4o",
  "agent": "coding",
  "tools": ["read_file", "write_file"],
  "stream": false
}
```

#### Streaming Chat (WebSocket)
```
WS /ws/chat
```
Send JSON messages, receive streaming chunks.

### Agents

#### List Agents
```
GET /agents
```

#### Create Agent
```
POST /agents
{
  "name": "Custom Agent",
  "description": "My custom agent",
  "model": "gpt-4o",
  "tools": ["read_file", "write_file"],
  "memory_scope": "project"
}
```

#### Run Agent
```
POST /agents/{id}/run
{
  "prompt": "Analyze this code"
}
```

### Automations

#### List Automations
```
GET /automations
```

#### Create Automation
```
POST /automations
{
  "name": "Daily Report",
  "trigger": {
    "type": "schedule",
    "expression": "0 9 * * *"
  },
  "steps": [
    {"agent": "research", "prompt": "Generate report"}
  ]
}
```

### Design

#### Generate Component
```
POST /design/generate
{
  "prompt": "Create a pricing card",
  "framework": "react",
  "styling": "tailwind"
}
```

#### Screenshot to Design
```
POST /design/screenshot
{
  "image_url": "https://example.com/screenshot.png"
}
```

### Knowledge Base

#### Upload Document
```
POST /knowledge/upload
{
  "name": "docs.pdf",
  "type": "pdf",
  "content": "base64_encoded_content"
}
```

#### Search
```
GET /knowledge/search?q=query&limit=10
```

### Files

#### List Files
```
GET /files?path=/workspace
```

#### Read File
```
GET /files/read?path=/workspace/src/main.py
```

#### Write File
```
POST /files/write
{
  "path": "/workspace/src/main.py",
  "content": "print('hello')"
}
```

#### Execute Command
```
POST /files/execute
{
  "command": "ls -la",
  "cwd": "/workspace"
}
```

### Usage

#### Get Usage Stats
```
GET /usage?period=7d
```

#### Provider Breakdown
```
GET /usage/providers
```

## WebSocket Events

### Client -> Server
```json
{
  "messages": [...],
  "model": "gpt-4o",
  "agent": "coding",
  "session_id": "uuid"
}
```

### Server -> Client
```json
// Chunk
{
  "type": "chunk",
  "data": {
    "id": "msg-1",
    "content": "Hello",
    "tool_calls": []
  }
}

// Done
{
  "type": "done"
}

// Error
{
  "type": "error",
  "message": "Something went wrong"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Internal Server Error |
| 503 | Service Unavailable |
