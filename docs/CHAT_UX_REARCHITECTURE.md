# CHAT UX REARCHITECTURE

## Design Principle

Hide architecture. Expose progress.

Users should see a single clean conversation, not the internal agent mesh.

## Current (What users see)

```
┌──────────────────────────────────────────────┐
│  User: hi                                     │
├──────────────────────────────────────────────┤
│  ┌─ Manager ─────────────────────────────┐   │
│  │  Thinking...                          │   │
│  └───────────────────────────────────────┘   │
│  ┌─ Fast Inference (Nvidia NIM/deepseek) ─┐  │
│  │  Hello! How can I help today?          │   │
│  └───────────────────────────────────────┘   │
│  ┌─ QA ──────────────────────────────────┐   │
│  │  Hi there! How can I help?            │   │
│  └───────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

Problems: Two responses, agent names visible, provider/model exposed, no progress indicators.

## Target (What users should see)

```
┌──────────────────────────────────────────────┐
│  User: hi                                     │
├──────────────────────────────────────────────┤
│                                              │
│  Hello! How can I help you today?            │
│                                              │
│  I can help with coding, debugging,          │
│  architecture, and more. What are you        │
│  working on?                                 │
│                                              │
└──────────────────────────────────────────────┘
```

Clean. Single response. Full-width content. No architecture visible.

## UI Component Architecture

```
ConversationTimeline (scroll container)
├── UserPill (bubble, right-aligned)
├── TurnContainer
│   ├── ActivityTimeline (during execution)
│   │   ├── ActivityItem (icon + label + optional progress)
│   │   ├── ActivityItem
│   │   └── ActivityItem (active pulse)
│   └── AssistantResponse (full-width, no wrapper)
│       ├── StreamingContent (ResponseStream during stream)
│       │   ├── Plain text (direct DOM append)
│       │   ├── InlineCodeBlock (pre-rendered)
│       │   └── FileCard (inline)
│       └── CompletedContent (ReactMarkdown on finish)
│           ├── Markdown body
│           ├── CodeBlock with syntax highlighting
│           ├── DiffBlock
│           └── FileCard[]
├── UserPill
└── TurnContainer...
```

## What Changes

### Remove from chat UI

| Element | Current Location | New Location |
|---------|-----------------|--------------|
| Agent name cards | Main timeline | Removed entirely |
| Provider names | Agent cards | Diagnostics panel |
| Model names | Agent cards | Diagnostics panel |
| Role IDs | Everywhere | Internal only |
| Execution IDs | Session headers | Internal only |
| Per-agent responses | Timeline (duplicate) | Merged to single response |

### Add to chat UI

| Element | Description |
|---------|-------------|
| Activity timeline | Shows what's happening (not who) |
| Live terminal output | Inline streaming command output |
| File cards | Inline clickable file changes |
| Progress indicators | Subtle, non-spinner |
| Completion checkmarks | Green check on done items |

## Visual Design Language

| Element | Style |
|---------|-------|
| User message | Bubble, right-aligned, subtle shadow |
| Assistant response | Full-width, no bubble, clean content |
| Activity items | Icon + label, left-aligned, muted |
| Code blocks | Dark background, syntax highlighted |
| Diff blocks | Green/red line markers |
| File cards | Compact, clickable, inline |
| Terminal output | Monospace, dark inset |
| Transitions | Fade, smooth height, no bounce |

## States

```
Idle:
  [User input area]

Processing:
  [User message] →
  [Activity timeline appears]
  [Streaming response appears below activities]
  [Activities complete one by one]

Completed:
  [User message]
  [Full response rendered]
  [All activities checkmarked]

Error:
  [User message]
  [Error state inline — retry button]
  No agent failure details visible
```

## Conversation Flow (Single Turn)

```
┌──────────────────────────────────────────────┐
│  What does the authentication module look    │
│  like? ────────────────────────── User ────  │
├──────────────────────────────────────────────┤
│                                              │
│  ◌ Planning approach                         │
│  ◌ Reading auth files                        │
│  ◌ Analyzing dependencies                    │
│  ● Summarizing findings                      │
│                                              │
│  The authentication module is organized      │
│  around three main layers:                   │
│                                              │
│  ## Core Auth (`src/auth/`)                  │
│  - `AuthProvider.tsx` — React context        │
│  - `useAuth.ts` — hook with session mgmt     │
│  - `auth-guard.ts` — route protection        │
│                                              │
│  [View auth directory] [Key files found: 12] │
│                                              │
└──────────────────────────────────────────────┘
```

## Diagnostics Panel (Developer Mode)

Toggle: `Ctrl+Shift+D` or Settings → Developer Mode

```
┌─ Diagnostics ────────────────────────────────┐
│  Execution: exec_abc123                       │
│  ├─ Manager → 120ms (routing)                │
│  ├─ Coder → 2.4s (provider: Nvidia NIM)      │
│  │  Model: deepseek-v4-flash                  │
│  │  Tokens: 1,240 in / 892 out                │
│  │  Tools: read_file, grep_files (3 calls)    │
│  └─ QA → 1.1s (auto-verified)                │
│  Total: 4.2s                                  │
└───────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Remove agent names from UI
- Strip agent cards from ConversationTimeline
- Remove provider/model badges
- Single response per turn

### Phase 2: Activity timeline
- Replace agent cards with activity items
- Map agent execution phases to human-readable activities
- Add completion checkmarks

### Phase 3: Streaming polish
- ResponseStream for all streaming (not StreamingContent)
- First-token fast path
- Remove RAF batching

### Phase 4: Terminal + tool display
- Live terminal output inline
- Tool results as natural content, not cards
- File cards with click-to-open

### Phase 5: Animations
- Subtle motion for activities
- Token fade-in
- Smooth height transitions
