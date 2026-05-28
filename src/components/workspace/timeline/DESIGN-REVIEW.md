# Design Review Checklist — Assistant Section (Code Canvas)

> Use this checklist to verify each component matches the premium design spec visually in the browser.

---

## 1. ChatPanel (Main Container)

- [ ] **Header**: Glass-morphism header with subtle gradient (`bg-gradient-to-r from-[#0c0c0d] to-[#0a0a0b]`)
- [ ] **Status indicator**: Animated pulsing dot when streaming; clean checkmark when complete
- [ ] **Memory pressure**: Gradient badge — amber < 85%, red > 85% with pulse animation
- [ ] **Mode selector**: Clean dropup with icon + label, smooth animation
- [ ] **Layout**: Proper spacing — header → SessionBar → timeline → context bar → approval gate → input

## 2. SessionBar

- [ ] **Current session display**: Shows active workspace/agent/model
- [ ] **Integration**: Clear visual grouping with input area below
- [ ] **Collapsible**: Can be minimized to save space

## 3. ExecutionTimeline (Scroll Container)

- [ ] **Scrollbar**: Ultra-thin, dark, only shows on hover (`scrollbar-thin scrollbar-thumb-white/[0.06]`)
- [ ] **Empty state**: Polished QuickActions grid with icons, descriptions, keyboard hints
- [ ] **Event transitions**: Staggered entrance animation (framer-motion `staggerChildren`)
- [ ] **Streaming awareness**: Smooth auto-scroll that pauses when user scrolls up
- [ ] **Turn separators**: Subtle dividers between conversation turns

## 4. TurnGroup

- [ ] **Active border glow**: Latest turn has blue border glow (`border-blue-500/20 shadow-blue-500/5`)
- [ ] **User avatar**: Blue gradient circle with User icon, properly sized (h-6 w-6)
- [ ] **Collapse/expand**: Smooth height animation via framer-motion AnimatePresence
- [ ] **Action buttons (hover)**: Copy, Retry, ThumbsUp, ThumbsDown — appear on hover with scale animation
- [ ] **Timestamp**: Right-aligned, monospace, subtle (`text-white/20`)

## 5. StepCard (Agent Response Card)

- [ ] **Glass-morphism**: Semi-transparent background with subtle backdrop blur
- [ ] **Active glow**: Running cards have animated blue border glow (`shadow-blue-500/5 animate-pulse`)
- [ ] **Role avatar**: Gradient background matching role (coder=blue, design=purple, browser=sky, etc.)
- [ ] **Status badge**: Animated spinner for running, checkmark for complete, X for error
- [ ] **Reasoning block**: Amber-tinted expandable section with Brain icon
- [ ] **Streaming text**: Smooth character reveal with eased speed curve
- [ ] **Code blocks**: Proper syntax highlighting with copy button
- [ ] **Tool call sections**: Expandable with live progress spinner
- [ ] **File edit sections**: Color-coded diff (+ green, - red), line numbers
- [ ] **Message actions**: Copy, Retry, Thumbs — visible at bottom on complete
- [ ] **Metrics footer**: Duration, model name, provider — subtle and informative

## 6. AssistantInput (Command Center)

- [ ] **Container**: Glass-morphism border with gradient glow on focus
- [ ] **Placeholder**: Informative, changes based on context
- [ ] **Slash commands**: Dropup menu with icons, descriptions, keyboard navigation
- [ ] **Agent mentions**: Dropup menu with @agent syntax, icons, descriptions
- [ ] **Mode chip**: Shows current execution mode with color coding
- [ ] **Ready status**: Green dot when runtime is ready, amber when standby
- [ ] **Send button**: Gradient (blue→purple) when has input, disabled state when empty
- [ ] **Cancel button**: Red when processing, allows stopping execution
- [ ] **Keyboard hints**: "↵ send · ⇧↵ newline" helper text
- [ ] **Drag-drop zone**: Subtle hint that files can be dragged in

## 7. ContextBar

- [ ] **Token progress bar**: Green <60%, amber 60-85%, red >85%
- [ ] **Memory pressure indicator**: Animated bar with color transitions
- [ ] **Workspace name**: Truncated with folder icon
- [ ] **Active agent**: Current role displayed with icon
- [ ] **Model name**: Displayed when available

## 8. ApprovalGate

- [ ] **Card style**: Consistent with StepCard glass-morphism
- [ ] **Tool summary**: Clear, actionable operation description
- [ ] **Buttons**: Approve (green), Deny (red), Always-Allow toggle
- [ ] **Countdown**: 60-second timer with visual progress

## 9. Responsiveness & Edge Cases

- [ ] **Empty workspace**: Shows polished QuickActions with tool suggestions
- [ ] **Long messages**: Properly wrapped, scrollable
- [ ] **Many tool calls**: Sections collapse gracefully
- [ ] **Error states**: Red-tinted cards with clear error messages
- [ ] **Loading state**: Spinner/pulse indicators, no layout shift
- [ ] **Network reconnection**: Graceful degradation

## 10. Accessibility

- [ ] **ARIA labels**: All interactive elements have aria-labels
- [ ] **Keyboard navigation**: Tab order logical, Enter/Space activates
- [ ] **Focus indicators**: Visible focus rings on all interactive elements
- [ ] **Color contrast**: Text meets WCAG contrast ratios
- [ ] **Screen reader**: `role="log"` on timeline, `aria-live="polite"` for streaming
