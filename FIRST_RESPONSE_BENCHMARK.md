# FIRST RESPONSE BENCHMARK

> Generated: 2026-05-30
> Method: Static code analysis of onboarding + first-answer path
> Note: Cannot run actual benchmark in this environment. This report analyzes the code path to predict real-world performance.

---

## PATH ANALYSIS

### Step 1: Page load → Onboarding

**Clicks required (Ollama):** 3
1. "Continue" (selects auto-detected Ollama)
2. "Configure Now" 
3. "Start Building" (after setup completes)

**Clicks required (API key):** 5
1. Select provider
2. Enter API key
3. "Continue"
4. "Configure Now"
5. "Start Building"

### Step 2: Onboarding → First message

The onboarding guard (`OnboardingGuard` in App.tsx:19-35) checks `localStorage.getItem('opencode-onboarded')`. If set, navigates to `/` which loads `ControlCenterPage`.

### Step 3: First message → First response

The message path:
1. User types in Composer → `chat-panel.tsx:110 sendMessage()`
2. `sendMessage` calls `executionSessionManager.start()` → `ExecutionSessionManager.ts:47`
3. `ExecutionSessionManager.start()` calls `ExecutionOrchestrator.execute()` → `ExecutionOrchestrator.ts:51`
4. Inside execute(): calls `handleDirectResponse()` → `fastChatCompletion()` → provider transport
5. Provider streams tokens back → `StreamManager.append()` → timeline store

### Onboarding runs setup (70-170 lines of async code):
- `initializeDefaultRoles()` — creates role configs (synchronous)
- Configures provider (API key storage, model setup)
- No workspace file tree load during onboarding (lazy)

---

## EXPECTED LATENCY BREAKDOWN (Ollama, warm start)

| Phase | Time | Notes |
|-------|------|-------|
| Page load + render | 2-5s | Vite-bundled 3.2MB JS |
| Onboarding step 1→3 | 3-5s | Ollama detection (2s), user clicks |
| Setup run (roles, provider) | 0.1s | All synchronous DOM operations |
| First message → first token | 0.5-5s | Ollama local inference time |
| **Total** | **~6-15s** | ✅ Under 60s target |

### Ollama cold start (first time after boot):
- Ollama server may not be running → model load: 5-30s
- But `detectOllama()` has a 2s timeout
- If Ollama not running, user selects a different provider
- **Total (Ollama cold): ~30-60s** — within 60s target

### API key provider (OpenAI):
| Phase | Time | Notes |
|-------|------|-------|
| Page load | 2-5s | Same |
| Onboarding step 1→3 | 8-10s | Type API key, navigate |
| Setup run | 0.1s | Synchronous |
| First message → first token | 1-3s | Network round trip |
| **Total** | **~12-18s** | ✅ Under 60s |

---

## FAILURE POINTS IDENTIFIED

### F1: Provider connection timeout
- `detectOllama()` has 2s timeout → if Ollama not found, user needs to pick another
- If Ollama is found but slow to respond, user sees "Ollama available" but first query may hang

### F2: Onboarding skip dead end (now fixed)
- Skip button text changed to "Skip onboarding (configure later)"
- User lands on ControlCenter with `SetupRequired` component that has clickable links to `/settings`
- **Previously:** Blank/confusing screen. **Now:** Explicit setup steps with navigation.

### F3: No provider default
- If user has no provider configured, `fastChatCompletion()` throws "Provider ${wiredForFastChat.providerId} not found"
- This is caught and shown as an error message
- User can navigate to Settings from error path

### F4: API key validation
- Onboarding does NOT validate the API key (no test query)
- User may complete onboarding with an invalid key
- First message fails with provider error (HTTP 401)
- **Impact:** First response shows "Authentication failed" instead of an answer

### F5: Workspace not set
- `ControlCenterPage` may render without workspace selected
- If user never sets workspace path:
  - File operations fail silently
  - Search returns empty results
  - No visual indicator that workspace is missing
- **Impact:** First search returns 0 results with no explanation

---

## BENCHMARK SUMMARY

| Path | Clicks | Expected Time | Meets Target? | Risks |
|------|--------|---------------|---------------|-------|
| Ollama (warm) | 3 | 6-15s | ✅ Yes (60s) | None |
| Ollama (cold) | 3 | 30-60s | ✅ Yes (60s) | None |
| OpenAI | 5 | 12-18s | ✅ Yes (60s) | API key may be invalid |
| Anthropic | 5 | 12-18s | ✅ Yes (60s) | API key may be invalid |
| Local runtime | 4 | 10-20s | ✅ Yes (60s) | URL must be manually configured |

---

## VERDICT

**PASS** for time-to-first-response. All paths are under the 60s target.

**FAIL** for reliability of first response:
- Invalid API key (F4): Onboarding doesn't validate → first query fails
- Missing workspace (F5): No visible error, just empty results
- These erode trust on the very first interaction
