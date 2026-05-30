# Getting Started

## Prerequisites

- **Node.js** >= 18
- **npm** (included with Node.js)
- **Rust** (for Tauri desktop builds only — not required for web development)

## Quick Install

```bash
git clone https://github.com/patil-shubham-dev/Agentic-OS.git
cd AgenticOS
npm install
```

## Start Developing

```bash
# Web-only (browser)
npm run dev
# → http://localhost:5173

# Desktop app
npm run tauri:dev
```

## First Run

1. Open the app in your browser or desktop
2. Go to **Settings → Providers** to add an AI provider
3. Go to **Settings → Roles** to assign providers to agent roles
4. Type a message in the chat panel and press Enter

## Build for Production

```bash
# Web build
npm run build
# Output: dist/

# Desktop installer
npm run tauri:build
# Output: src-tauri/target/release/
```

## Key Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server (browser) |
| `npm run tauri:dev` | Tauri desktop dev |
| `npm run build` | Production web build |
| `npm run tauri:build` | Desktop installer build |
| `npm run test` | Run test suite |
| `npm run lint` | Lint all files |

## Project Structure

```
AgenticOS/
├── src/                    # Application source
│   ├── runtime/            # Core execution engine
│   ├── components/         # React UI
│   ├── stores/             # Zustand state stores
│   └── lib/                # Legacy implementations
├── packages/
│   ├── providers/          # Provider connectivity
│   └── shared/             # Shared types
├── src-tauri/              # Tauri desktop backend
└── docs/                   # Documentation
```

## Need Help?

- Check `docs/TROUBLESHOOTING.md` for common issues
- Check `docs/PROVIDER_SETUP.md` for provider configuration
- Check `docs/FIRST_PROJECT.md` for a complete walkthrough
