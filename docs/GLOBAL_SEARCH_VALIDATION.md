# Global Search — Validation

## Test Scenarios

### Filename Search
| Scenario | Input | Expected |
|----------|-------|----------|
| Partial match | `button` | Finds `Button.tsx`, `icon-button.tsx` |
| Exact match | `App.tsx` | Finds `App.tsx` |
| Case-sensitive on | `APP` | Does NOT find `App.tsx` |
| Empty query | `` | Shows "Type to search filenames" placeholder |
| No match | `zzzzz_nonexistent` | Shows "No results found" |
| Dotfile skip | `.gitignore` | Should appear (not a dir) |
| Node_modules skip | files in `node_modules/` | NOT in flat file list |

### Content Search
| Scenario | Expected |
|----------|----------|
| Term found in multiple files | Results grouped by file, line numbers correct |
| Term NOT found | "No matches found" |
| New query while searching | Old search aborted via AbortController |
| Binary file skip | `.png`, `.jpg`, `.map` files NOT read |
| Case-sensitive | Only exact case matches |
| Large repo (50k+ files) | Batches at 10 concurrent, status shows progress |
| File read error (permissions) | Skipped silently, search continues |

### Keyboard Navigation
| Key | Expected |
|-----|----------|
| `↓` | Moves selection down |
| `↑` | Moves selection up |
| `Enter` on file | Opens file via `onOpenFile(path)` |
| `Enter` on match | Opens file at line via `onOpenFile(path, line)` |
| `Esc` | Closes panel |
| Selection wraps at edges | Stops at min/max |

### UI States
| State | Visual |
|-------|--------|
| Closed | Not rendered (returns null) |
| Empty idle | Centered placeholder with keyboard shortcut hints |
| Searching | Spinner in status bar + progress counter |
| Results found | File headers with match count (content mode) |
| No results | "No results found" with contextual tip |
| Error reading file | Silent skip, no error toast |

### Integration
- Open/close via explorer header button
- Open/close via `Ctrl+Shift+F` toggle
- Backdrop click closes panel
- Panel re-initializes (clears query/results) on open
- `onOpenFile(path, line)` navigates to correct file and line

## Edge Cases
- Very long lines (>1000 chars) — truncated in match preview
- Files with mixed line endings — split works for both `\n` and `\r\n`
- Special regex chars — uses `String.includes()`, NOT regex — no injection risk
- Empty files — no matches, silently skipped
- 1000+ matches — all rendered, no virtualization (acceptable for AI workspace sizes)
- Rapid query changes — debounced at 300ms for content mode
