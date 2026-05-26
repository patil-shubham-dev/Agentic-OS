# Code Canvas Redesign — Architecture & Implementation Spec

> **Scope:** Code Canvas tab ONLY. All other pages/tabs continue functioning normally.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Global Navigation Rail (Replaces Sidebar)](#2-global-navigation-rail)
3. [Code Canvas 4-Panel Layout](#3-code-canvas-4-panel-layout)
4. [Explorer Panel (File Tree)](#4-explorer-panel)
5. [Assistant Workspace (Execution Timeline)](#5-assistant-workspace)
6. [Dynamic Workspace Panel (Code/Browser/Design)](#6-dynamic-workspace-panel)
7. [Code Mode](#7-code-mode)
8. [Browser Mode](#8-browser-mode)
9. [Design Mode / OpenDesign Agent](#9-design-mode)
10. [Status & Runtime Awareness](#10-status--runtime-awareness)
11. [Component Inventory & Files to Create/Modify](#11-component-inventory)
12. [Implementation Phasing](#12-implementation-phasing)

---

## 1. Architecture Overview

### Current State
- AppLayout wraps all pages with `<Sidebar />` + `<Outlet />`
- Code Canvas uses 3-panel layout: FileTree | Editor/Panel | RightPanel(tabs)
- ChatPanel is bubble-based, centered on message[] rendering
- Terminal (RunPanel) sits below the editor
- Top status bar + bottom footer bar present

### Target State
- **Global:** DesktopSidebar → replaced by collapsed Navigation Rail (for ALL pages)
- **Code Canvas ONLY:** 4-panel layout: `Navigation Rail | Explorer | Assistant Workspace | Dynamic Workspace Panel`
- Assistant becomes execution-centric timeline (not chat bubbles)
- No visible terminal — terminal output embedded in assistant cards
- No heavy status bars — contextual state distribution
- Monaco Editor integration for Code mode
- Brand new Browser Workspace (Tauri multi-webview)
- New Design mode with OpenDesign agent infrastructure

---

## 2. Global Navigation Rail

### Purpose
Replaces the existing DesktopSidebar component as the app-level navigation for ALL pages.

### Location
- Far left, fixed narrow width (~52px collapsed, ~220px expanded)
- Collapsed by default, icons only
- Expands on hover/click with label reveal

### Visual Design
- Ultra-thin when collapsed
- Smooth width transitions (CSS: `transition-all duration-200`)
- Active section glow indicator (left border accent)
- Bottom section: user avatar, notifications, git branch

### Icons (Top → Bottom)
| Icon | Label | Route | Scope |
|------|-------|-------|-------|
| LayoutDashboard | Control Center | `/` | Global page |
| Code2 | Code Canvas | `/code-canvas` | Global page |
| Users | Agents | `/agents` | New page |
| Smartphone | Mobile Gateway | `/mobile-gateway` | Global page |
| Settings | Settings | `/settings` | Global page |
| ScrollText | Logs | `/logs` | New page |
| GitBranch | Git | `/git` | New page |
| ArrowUpCircle | Updates | `/settings/update` | Existing |

### Component Architecture
- New: `apps/web/src/components/layout/navigation-rail.tsx`
- Replaces DesktopSidebar usage in `App.tsx`'s `LayoutWithOutlet`
- DesktopSidebar can be kept for reference or removed

### States
- Collapsed (default): Icons only, tooltips on hover
- Expanded: Icons + labels, user clicks pin to keep open
- Active: Left accent bar + glow
- Notification badge: Unread count overlay

---

## 3. Code Canvas 4-Panel Layout

### Layout Structure (Left → Right)
```
| Navigation Rail (52px) | Explorer (240px) | Assistant Workspace (flex-1) | Dynamic Panel (420px min) |
```

### Implementation
- New file: `apps/web/src/pages/code-canvas.tsx` (rewrite)
- Remove: top status bar, bottom footer bar, old 3-panel layout
- New layout uses CSS grid or flex with resize handles between panels

### Window Feel
- Dark gradient background (`bg-[#0a0a0b]` through `#0c0c0d`)
- Subtle panel dividers (`border-r border-white/[0.06]`)
- Panel collapse/expand via keyboard shortcuts
- Resize handles between Explorer/Assistant/Workspace

---

## 4. Explorer Panel

### Location
- Second from left, after the Navigation Rail
- Width: ~240px, resizable min 180px / max 350px

### Components
- **Top toolbar** (ultra-minimal, icon-based):
  - Open Folder, New File, New Folder, Refresh, Collapse All, Search (filter)
- **File tree** (existing `FileTree` component, refactored)
  - Nested structure with git status indicators
  - File icons with language-based coloring (existing)
  - Active file highlighting
  - Right-click context menu: rename, delete, copy path
  - Drag-drop reordering (future)
- **Bottom section** (collapsible):
  - AI Context files (existing)
  - Recent / Suggested files

### Changes from Current
- Remove explorer-creation inline inputs from the main page, keep within FileTree
- Add explorer-level search/filter input
- Add git status indicators beside files
- Clean up toolbar styling to match new design language

---

## 5. Assistant Workspace

### Core Transformation
This is the **most important** change. The ChatPanel is refactored into an **Execution Timeline**.

### Architecture
- New file: `apps/web/src/components/workspace/assistant-workspace.tsx`
- Replaces `ChatPanel` as the center/main component
- Rendering engine: `timelineItem[]` → renders contextual block types
- Keeps existing streaming engine, provider integration, message transport, persistence

### Timeline Item Types
| Type | Visual | Behavior |
|------|--------|----------|
| `reasoning` | Subtle thinking block | Show planning/reasoning steps |
| `execution` | Card with progress | File edits, tool calls, command runs |
| `conversation` | Inline text block | Clarifications, Q&A, discussion |
| `diff` | Code diff preview | File changes with +/-, review actions |
| `browser_action` | Browser-styled card | Navigation, clicks, form fills |
| `design_artifact` | Visual card | Generated designs, mockups, tokens |
| `log` | Collapsible output | Terminal output, build logs, errors |
| `approval` | Actionable card | User approval requests |
| `summary` | Completion block | Task summary, stats, next steps |

### Execution Card Example
```
┌────────────────────────────────────────┐
│ 🧠 Planning fix...                     │
│ ✓ Found Electron config                │
│ ✓ Found missing preload                │
│ → Updating startup handler             │
├────────────────────────────────────────┤
│ Edited electron-main.ts                │
│ +12 -3                                 │
│ [Review Changes]                       │
├────────────────────────────────────────┤
│ Running dev server...                  │
│ ✓ Server started on localhost:3000     │
│ [Open Browser] [Expand Logs]           │
└────────────────────────────────────────┘
```

### Input Area ("AI Command Center")
- Floating/premium design at bottom of assistant area
- Glassmorphism background
- Features:
  - Slash commands (`/fix`, `/generate`, `/refactor`, `/explain`)
  - Agent mentions (`@designer`, `@browser`, `@coder`)
  - Contextual chips (workspace, active file, model)
  - Drag-drop file support
- Above input: workspace context bar (Workspace | Active Agent | Model | Execution Mode)

### Preserved from ChatPanel
- Streaming engine and token-by-token rendering
- Provider/agent integration
- Orchestration pipeline (routing → delegation → synthesis)
- Memory management and context compression
- Conversation persistence

---

## 6. Dynamic Workspace Panel

### Location
- Far right, after the Assistant Workspace
- Width: 420px default, resizable (300px–700px)

### Mode Toggle Tabs (Top)
```
[Code] [Browser] [Design]
```
- Only ONE active mode at a time
- Tab switches change entire panel content
- Design tab auto-hides if no design artifacts exist (shows intelligent empty state)

### Auto-Switching Behavior
- **Fully automatic** (user can manually override)
- Editing/selecting file → auto-switch to Code
- Running dev server / browsing → auto-switch to Browser
- Generating redesign / design artifact → auto-switch to Design

### Resize Handle
- Between Assistant and Dynamic Panel
- Drag to resize (min 300px, max 700px)
- Collapse/expand via keyboard shortcut

---

## 7. Code Mode

### Implementation
- Integrate **Monaco Editor** (`@monaco-editor/react`)
- New component: `apps/web/src/components/workspace/editor-monaco.tsx`

### Features
- Syntax highlighting (all common languages)
- Line numbers, minimap, breadcrumbs
- Tab management (open files, close, reorder)
- Split editor support (side-by-side diff)
- Diagnostics / IntelliSense
- AI collaboration overlays:
  - Inline diff suggestions
  - Accept/Reject edit buttons
  - "AI Aware" badge on file

### Visual Style
- Premium dark theme
- Minimal chrome
- Soft syntax colors
- Clean typography (`JetBrains Mono`)

### Note
- Keep existing `EditorPanel` as a fallback/future option
- Monaco integration is opt-in per workspace setting

---

## 8. Browser Mode

### Architecture (New)
- **Do NOT use iframes.** Use Tauri v2 native multi-webview.
- Use **Playwright** as the core browser execution engine.
- Study **browser-use** patterns for DOM-Element Vision Tree & Action Matrix.

### Components
- New: `apps/web/src/components/workspace/browser-workspace.tsx`

### UI Layout
```
┌─────────────────────────────────┐
│ [←] [→] [↻] [URL Bar] [...]    │ ← controls
├─────────────────────────────────┤
│                                 │
│    Live Browser Viewport        │ ← native webview
│    (Tauri multi-webview)        │
│                                 │
├─────────────────────────────────┤
│ Navigated to /dashboard         │
│ Clicked "New Project"           │ ← activity stream
│ Filled signup form              │
│ Captured screenshot             │
└─────────────────────────────────┘
```

### Browser Engine Layer
- Action primitives (structured, similar to browser-use):
  - `ClickElement`, `TypeText`, `ScrollDown`, `NavigateTo`
  - `WaitFor`, `ExtractText`, `CaptureScreenshot`
- Accessibility-first locators (`getByRole`, `getByPlaceholder`)
- Deterministic selectors over vision-based approaches

### Integration
- Assistant streams browser activity inline in timeline
- Auto-refresh on file changes (code → browser)
- Dev server status indicator
- Screenshot analysis bridge for Design mode

### Future-Proofing
- Phase 1: Local Tauri native webview
- Phase 2: Remote/cloud Playwright execution with screencast streaming

---

## 9. Design Mode / OpenDesign Agent

### Philosophy
- NOT a static preview or screenshot gallery
- Should feel like "Figma + v0 + Claude + Cursor" combined
- Build toward the **OpenDesign agent** architecture NOW, incrementally
- Use current LLM infrastructure for V1 generation

### UI Layout
```
┌──────────────────────────────────────────┐
│ Design Suggestions                       │
│ Generated by OpenDesign Agent            │
│ [Regenerate] [Compare] [Apply] [Export]  │
├──────────────────────────────────────────┤
│                                          │
│    High-fidelity mockup preview          │
│    (centered, premium framing)           │
│                                          │
├──────────────────────────────────────────┤
│ Changes Made:     │ Design Intent:       │
│ ✓ Improve spacing │ Enterprise clarity   │
│ ✓ Typography      │ Inspired by Linear   │
│ ✓ Color system    │ and Notion           │
├──────────────────────────────────────────┤
│ v1 Minimal | v2 Glass | v3 Enterprise    │
│ [← version gallery →]                    │
└──────────────────────────────────────────┘
```

### OpenDesign Agent Architecture
- **New role:** `OpenDesign` / `design` (enhanced from existing)
- Wired into existing provider/model system (Settings → Roles)
- Uses same provider infrastructure as coding agents
- Add a dedicated "Design Agent" role in Settings/Roles

### V1 Features
- Generate component layouts, Tailwind UI concepts
- Design suggestions and redesign recommendations
- Style-system output (tokens, spacing, typography)
- Conversational iteration: "Make it more like Linear"
- Design-to-code workflow (Apply → frontend agent updates files → Browser refreshes)

### Design Artifacts
First-class objects supporting:
- Version history
- Comparisons
- Prompt/metadata tracking
- Linked frontend files
- Generation source

### Future Evolution
- Image generation support
- Screenshot understanding / visual diffing
- UI extraction from screenshots
- Live redesign suggestions from browser

### Design Intelligence Sidebar
- Changes Made explanation
- Design Intent reasoning
- Design Tokens display
- Iteration history

---

## 10. Status & Runtime Awareness

### Guiding Principle
Remove traditional IDE chrome (status bars, footers). Redistribute runtime awareness contextually.

### Where Status Goes

| Signal | Location |
|--------|----------|
| Execution state | Assistant timeline (primary) |
| Active agent | Assistant input context bar |
| Current model | Assistant input context bar |
| Git changes | Explorer (file indicators) + Nav rail badge |
| Runtime health | Nav rail icon indicator |
| Memory pressure | Implicit in performance; alert only on threshold |
| Provider count | Nav rail (subtle badge) |
| Dev server state | Browser mode header |
| Error diagnostics | Inline in assistant timeline |

### Minimal Floating Header
- Appears at top of Code Canvas only when useful
- Shows: `Workspace: MyProject | Agent: Autonomous | Model: DeepSeek V4`
- Auto-hides, low prominence, ambient style
- NOT a persistent toolbar

---

## 11. Component Inventory

### New Files to Create
| File | Purpose |
|------|---------|
| `apps/web/src/components/layout/navigation-rail.tsx` | Global collapsed nav rail |
| `apps/web/src/components/workspace/assistant-workspace.tsx` | Refactored execution timeline |
| `apps/web/src/components/workspace/timeline-card.tsx` | Individual timeline block renderer |
| `apps/web/src/components/workspace/timeline-types.ts` | Timeline item type defs |
| `apps/web/src/components/workspace/execution-card.tsx` | Execution block (edits, commands) |
| `apps/web/src/components/workspace/design-card.tsx` | Design artifact card for timeline |
| `apps/web/src/components/workspace/browser-card.tsx` | Browser action card for timeline |
| `apps/web/src/components/workspace/diff-card.tsx` | Inline diff preview card |
| `apps/web/src/components/workspace/approval-card.tsx` | User approval request card |
| `apps/web/src/components/workspace/assistant-input.tsx` | AI command center input area |
| `apps/web/src/components/workspace/context-bar.tsx` | Context bar above input |
| `apps/web/src/components/workspace/workspace-header.tsx` | Minimal floating workspace header |
| `apps/web/src/components/workspace/browser-workspace.tsx` | New Browser mode component |
| `apps/web/src/components/workspace/design-workspace.tsx` | New Design mode component |
| `apps/web/src/stores/timeline-store.ts` | Timeline items state store |

### Major Files to Modify
| File | Changes |
|------|---------|
| `apps/web/src/App.tsx` | Replace DesktopSidebar with NavigationRail |
| `apps/web/src/pages/code-canvas.tsx` | Full rewrite — 4-panel layout |
| `apps/web/src/components/desktop-sidebar.tsx` | Deprecated / replaced by nav rail |
| `apps/web/src/components/workspace/chat-panel.tsx` | Refactored into assistant-workspace |
| `apps/web/src/components/workspace/editor-panel.tsx` | Enhanced/Monaco integration |
| `apps/web/src/components/workspace/browser-panel.tsx` | Refactored into browser-workspace |
| `apps/web/src/stores/workspace-store.ts` | Add timeline + panel state |
| `apps/web/src/stores/agent-store.ts` | Add timeline item actions |
| `apps/web/src/types/index.ts` | Add TimelineItem, DesignArtifact types |
| `apps/web/src/runtime/workspace-runtime.ts` | Add design agent wiring |

### Files to Remove
| File | Reason |
|------|--------|
| `apps/web/src/components/workspace/run-panel.tsx` | Terminal removed |
| `apps/web/src/components/desktop-sidebar.tsx` | Replaced by nav rail |
| `apps/web/src/components/design/preview-panel.tsx` | Replaced by design-workspace |
| `apps/web/src/components/design/design-tab.tsx` | Replaced by design-workspace |

### Files to Keep (Refactored/Reused)
| File | Reason |
|------|--------|
| `apps/web/src/components/workspace/file-tree.tsx` | Refine styling, keep logic |
| `apps/web/src/components/workspace/diff-viewer.tsx` | Integrate into diff-card |
| `apps/web/src/components/workspace/git-panel.tsx` | Move to /git route |
| `apps/web/src/components/workspace/transaction-log.tsx` | Move to /logs route |
| `apps/web/src/lib/agents/orchestrator.ts` | Keep streaming/transport |
| `apps/web/src/stores/agent-store.ts` | Keep state architecture |
| `apps/web/src/lib/ai-service.ts` | Keep provider integration |
| `apps/web/src/runtime/workspace-runtime.ts` | Keep runtime wiring |

---

## 12. Implementation Phasing

### Phase 1 — Foundation (Layout & Navigation)
- [ ] Create `NavigationRail` component
- [ ] Update `App.tsx` to use NavigationRail globally
- [ ] Rewrite `code-canvas.tsx` with 4-panel layout (empty panels)
- [ ] Implement panel resize handles and collapse/expand
- [ ] Add new routes: `/agents`, `/logs`, `/git`

### Phase 2 — Assistant Timeline
- [ ] Create `TimelineItem` types and `timeline-store.ts`
- [ ] Create `TimelineCard` renderer with block-type switching
- [ ] Create `ExecutionCard`, `DiffCard`, `ReasoningCard`, `ConversationCard`
- [ ] Create `AssistantInput` with slash commands and agent mentions
- [ ] Create `ContextBar` (workspace/agent/model)
- [ ] Refactor ChatPanel streaming into timeline architecture
- [ ] Implement `ApprovalCard` for human_guided mode

### Phase 3 — Code Mode (Monaco)
- [ ] Install `@monaco-editor/react` and configure
- [ ] Create `EditorMonaco` component
- [ ] Wire tab management, file open/close, dirty state
- [ ] Add AI overlays (diff suggestions, accept/reject)

### Phase 4 — Browser Mode
- [ ] Create `BrowserWorkspace` component (UI scaffold)
- [ ] Integrate Playwright-based automation engine
- [ ] Implement Tauri native multi-webview for localhost
- [ ] Add activity stream and action feed
- [ ] Wire auto-switching from assistant timeline

### Phase 5 — Design Mode & OpenDesign Agent
- [ ] Add OpenDesign role to role registry
- [ ] Create `DesignWorkspace` component
- [ ] Implement versioning structure (v1, v2, etc.)
- [ ] Create design artifact types and store
- [ ] Wire Apply-to-Code workflow hooks
- [ ] Add Design agent to Settings → Roles

### Phase 6 — Polish
- [ ] Status redistribution (remove old bars)
- [ ] Add floating workspace header
- [ ] Animation pass (transitions, micro-interactions)
- [ ] Accessibility pass (keyboard nav, ARIA labels)
- [ ] Remove deprecated files
- [ ] Typecheck and test
