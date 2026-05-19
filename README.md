# ON-CALL

A DevSecOps incident response game built with Vite, React, and TypeScript. It's 21XX. Auth just went dark. You have 5 minutes to identify and roll back the broken service before the timer expires.

## Setup

```bash
nix develop
npm run dev
```

The dev server runs on `http://localhost:5173`.

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Prototype Scope (Stage 1)

- Start screen with keypress advance
- Main menu
- 5-minute countdown timer
- 10 rollback target cards (one correct)
- 30/70 outcome split on wrong guess (instant game over or −45s penalty)
- Win/Game Over end screens
- Full restart loop

Stages 2 and 3 deferred.

---

## AI Attribution

Portions of this project were developed with assistance from Claude (Anthropic, 2025).
