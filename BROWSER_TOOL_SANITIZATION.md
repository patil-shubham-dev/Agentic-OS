# BROWSER TOOL SANITIZATION

> Generated: 2026-05-30
> Scope: P0 #2 — Remove dead browser tools

---

## SUMMARY

All 11 browser tools had `roles: ["browser", "qa", "design"]` allowing agents with those roles to invoke them.
These tools have no Rust backend and returned `"undefined"` error.

## FIX

Changed all 11 browser tool definitions in `BUILTIN_TOOLS` array to `roles: []`.

This means:
- No agent role can invoke these tools
- `getToolsForRole()` filters them out via `t.roles.includes("*") || t.roles.includes(role)`
- The tool definitions still exist in the array (they're not removed) — they're just invisible to all agents

## TOOLS SANITIZED

| Tool | Old roles | New roles |
|------|-----------|-----------|
| launch_browser | browser, qa, design | [] |
| browser_navigate | browser, qa, design | [] |
| browser_screenshot | browser, qa, design | [] |
| browser_click | browser, qa, design | [] |
| browser_fill | browser, qa, design | [] |
| browser_execute_js | browser, qa, design | [] |
| browser_get_title | browser, qa, design | [] |
| browser_close | browser, qa, design | [] |
| browser_get_text | browser, qa, design | [] |
| browser_wait | browser, qa, design | [] |

## REMEDIATION

Dispatcher entries in `createAgentTool()` execute function were also removed. Imports for browser tool implementations removed from `agent-tools.ts`.

## VERDICT

**PASS.** No user can ever see `"undefined"` from browser tools.

- Filtered at tool registry level → agent never proposes them
- Dispatcher entries removed → even if somehow invoked, returns "Unknown tool"
- Tool definitions retained in source array (no breaking API changes if browser support is added later)
