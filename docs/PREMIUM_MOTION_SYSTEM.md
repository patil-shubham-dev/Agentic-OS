# PREMIUM MOTION SYSTEM

## Design Philosophy

Subtle motion that feels intentional, not decorative.

Every animation serves a purpose:
- Direct attention to changes
- Show progress without interruption
- Smooth transitions that feel natural
- Zero unnecessary movement

## What NOT to do

| ❌ Avoid | Why |
|----------|-----|
| Spinners | Indeterminate, noisy, adds visual load |
| Bouncing loaders | Distracting, feels cheap |
| Flashy transitions | Competing for attention |
| Staggered reveals | Delays content, frustrating |
| Continuous animations | Drains battery, annoys users |
| Rotation animations | Nausea-inducing, unprofessional |

## Allowed Animations

### 1. Activity Timeline Progress

```css
/* Completion checkmark — subtle scale + fade */
.activity-checkmark {
  animation: checkmark-appear 0.2s ease-out;
}
@keyframes checkmark-appear {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* Active item — gentle pulse on the dot */
.activity-dot.active {
  animation: dot-pulse 1.5s ease-in-out infinite;
}
@keyframes dot-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

/* Activity text transition */
.activity-label {
  transition: color 0.15s ease;
}
.activity-label.completed { color: var(--success); }
.activity-label.active { color: var(--foreground); }
.activity-label.pending { color: var(--foreground-muted); }
```

### 2. Token Appearance

```css
/* Each token fades in as it appears */
.token-char {
  animation: token-appear 0.05s ease-out;
}
@keyframes token-appear {
  from { opacity: 0; }
  to { opacity: 1; }
}
/* Fast enough to be imperceptible per character */
/* Prevents visual "pop-in" without adding delay */
```

### 3. Response Height Transitions

```css
/* Smooth height transitions as content grows */
.response-container {
  transition: height 0.15s ease-out;
  overflow: hidden;
}
/* Use ResizeObserver to transition height changes */
/* Instead of auto-height jumpiness */
```

### 4. Activity Item Transitions

```css
/* Activity items slide in smoothly */
.activity-item {
  animation: activity-enter 0.2s ease-out both;
}
@keyframes activity-enter {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* Stagger children: each item delays slightly */
.activity-item:nth-child(1) { animation-delay: 0ms; }
.activity-item:nth-child(2) { animation-delay: 50ms; }
.activity-item:nth-child(3) { animation-delay: 100ms; }
```

### 5. File Card Appearance

```css
/* File cards fade in when detected */
.file-card {
  animation: file-card-enter 0.2s ease-out;
}
@keyframes file-card-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### 6. Completion State

```css
/* Subtle green glow on completion */
.response-container.complete {
  transition: box-shadow 0.3s ease;
  box-shadow: 0 0 0 1px var(--success-alpha);
}
/* Removes after 1s */
```

### 7. User Message Send

```css
/* User message slides up as it sends */
.user-bubble {
  animation: user-bubble-enter 0.15s ease-out;
}
@keyframes user-bubble-enter {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

## Implementation

```typescript
// src/runtime/motion/MotionController.ts

class MotionController {
  private prefersReducedMotion: boolean

  constructor() {
    this.prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
  }

  get duration(): { fast: number; normal: number; slow: number } {
    if (this.prefersReducedMotion) {
      return { fast: 0, normal: 0, slow: 0 }
    }
    return {
      fast: 150,  // token, checkmark
      normal: 200, // activity enter, file card
      slow: 300,   // container transitions
    }
  }

  shouldAnimate(): boolean {
    return !this.prefersReducedMotion
  }
}

export const motionController = new MotionController()
```

## CSS Architecture

```css
/* Token animation — applied per character */
@keyframes token-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Activity list */
.activity-item {
  --enter-delay: 0ms;
}

/* Scroll-triggered transitions */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Animation Budget

| Element | Duration | Easing | Trigger |
|---------|----------|--------|---------|
| Token fade-in | 50ms | ease-out | Per character |
| Checkmark | 200ms | ease-out | Activity complete |
| Activity enter | 200ms | ease-out | New activity |
| Height transition | 150ms | ease-out | Content growth |
| File card | 200ms | ease-out | File detected |
| Completion glow | 300ms | ease | Execution done |
| User bubble | 150ms | ease-out | Message sent |

## No Animation States

```css
/* Initial load: no animation */
.timeline-initial .activity-item {
  animation: none;
  opacity: 1;
}

/* During streaming: minimal animation */
.is-streaming .activity-item {
  animation-duration: 100ms;
}

/* On error: no animation, just state */
.has-error .activity-checkmark {
  animation: none;
}
```

## React Implementation

```typescript
// useTransitionVisibility hook
function useTransitionVisibility() {
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Small delay to allow DOM insertion before animation
    const id = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (prefersReducedMotion) return { shouldAnimate: false, isVisible: true }
  return { shouldAnimate: true, isVisible }
}
```

## File Structure

```
src/runtime/motion/
├── MotionController.ts    — Singleton controller
├── animations.css         — All keyframe definitions
├── useTransitionVisibility.ts — React hook
└── index.ts              — Exports
```
