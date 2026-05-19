# CLAUDE.md — On-Call Prototype

## Project

**On-Call** — a DevSecOps incident response game. It's 21XX. Auth just went dark at 3:47 AM. The player triages the outage, identifies the breach, and deploys a fix using a terminal, monitoring dashboard, and AI assistant (Bob) before the timer expires.

## Tech Stack

- **Vite + React + TypeScript**
- Single-page app, no router needed
- CSS via plain CSS modules in `index.css`
- Font: `ui-monospace, 'JetBrains Mono', 'Cascadia Code', Consolas` (system stack)

## Prototype Scope

**Stage 1 only.** The prototype is complete when a player can run the full core loop end-to-end:

1. Start screen → keypress → Main menu → Start Game
2. Stage 1 triage dashboard with 10 rollback cards + live 5-minute timer
3. Select a card → Execute Rollback → outcome (correct → WIN / wrong → 30/70 split)
4. End screen (WIN or GAME OVER) → Restart → back to Start

No Stage 2. No Stage 3. No procedural generation. Hardcoded scenario object only.

## Color Palette

```
background base:    #0a0e14
background alt:     #0d1117
panel:              #0f1520
border:             #1a2332
text-dim:           #3d4f63
text-mid:           #7a8fa8
text-bright:        #c8d8ea
amber (Stage 1):    #f5a623
green (correct):    #3ecf8e
blue (secondary):   #4a9eff
red (danger):       #e05252
```

## Hardcoded Scenario

```typescript
SCENARIO = {
  incidentId: 'INCIDENT-2247',
  summary: 'POST /auth/validate → 403 since 03:14 UTC. All sessions invalidated.',
  correctTargetId: 'tgt-02',
  targets: [
    { id: 'tgt-01', service: 'auth-service',     version: 'v2.3.2', tag: 'current deploy'  },
    { id: 'tgt-02', service: 'auth-service',     version: 'v2.3.1', tag: 'last stable'     },
    // ... 8 more targets
  ]
}
```

## Stage 1 State & Logic

**Timer:** Countdown from 300s (5 min), decrement every 1000ms. At 0:00 → GAME OVER.

**evaluateRollback():**
```
if selectedId === SCENARIO.correctTargetId:
  → WIN screen
else:
  if Math.random() < 0.30:
    → GAME OVER screen
  else:
    timeLeft -= 45 (floor at 0)
    selectedId = null (deselect, player retries)
```

**Stats:** Completion time, rollback attempts (not yet implemented in prototype).

## Scene State Machine

```
start → (any keydown/click) → menu
menu → (START click) → playing
playing → (win) → win screen
playing → (loss) → gameover screen
playing → (time 0:00) → gameover screen
win/gameover → (RESTART click) → start
```

## Acceptance Criteria — Stage 1 Complete

1. ✓ Start screen appears; any key transitions to menu.
2. ✓ Menu → START → Stage 1 triage with running timer.
3. ✓ Selecting a card highlights it and updates the confirm bar.
4. ✓ Execute Rollback on correct card → WIN screen.
5. ✓ Execute Rollback on wrong card → 30% GAME OVER or 70% −45s penalty + retry.
6. ✓ Timer reaching 0:00 → GAME OVER screen.
7. ✓ Restart from end screen → Stage 1 re-renders with timer reset.
8. ✓ No JS errors in console.
9. ✓ Visual matches design (dark base, amber/green accents, monospace aesthetic).

## What NOT to Build in This Prototype

- Stage 2 investigation panel
- Stage 3 remediation panel
- Procedural scenario generation
- Dynamic Bob query handler — static terminal only
- Audio
- Animation sequences

## Next Steps (Post-Prototype)

- Stage 2: Evidence board, pin mechanic, correlation analysis
- Stage 3: Code fix blocks, deployment
- Procedural incident generation
- Bob as a real chat interface
- Audio + visual effects
- Leaderboard / replay system
