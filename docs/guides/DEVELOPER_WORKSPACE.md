# Developer Workspace Guide

AgenticOS now includes a full development workspace. This guide covers the new productivity features.

## Quick Start

1. Open a folder via the Code Canvas sidebar → `Open Workspace` button
2. Files appear in the file tree; click to open in the Monaco editor
3. Use `Ctrl+P` for the command palette, `Ctrl+Shift+F` for global search

## Monaco Editor

- **Syntax highlighting** for 20+ languages (auto-detected by extension)
- **Minimap** on the right (toggle with toolbar button)
- **Multi-cursor**, find/replace, bracket matching, folding
- **Format** support for TypeScript/JavaScript/CSS/JSON
- **Word wrap** toggle in the toolbar

## Global Search (`Ctrl+Shift+F`)

- Searches file names + file contents instantly via in-memory index
- Filter by extension using the dropdown in the search input
- Results appear as you type; click to navigate

## Terminal (`Ctrl+Shift+T`)

- Multi-session terminal with tab bar
- Each session runs a command with streaming output
- Cancel running commands with the X button
- Copy output with the copy icon
- ArrowUp cycles through command history
- Exit code and duration shown per session

## Problems Panel (`Ctrl+Shift+.`)

- Shows errors and warnings for open files
- Click any problem to navigate to its location in the editor
- Error/warning counts shown in the editor toolbar badge
- Severity-coded: red (error), yellow (warning), blue (info)

## State Persistence

Your workspace state is automatically saved:
- Open files and active tab
- Cursor position and scroll position
- Panel layout (explorer open/closed, widths)

Restored on next workspace load.

## Git Integration

- Current branch name shown in the editor toolbar
- Changed file count shown next to branch name
- Click the Git icon in the sidebar or use `Ctrl+Shift+G` for full git panel (commit, status, log, restore)
- Polls for changes every 30 seconds
