# GitHub Milestone **0.4.1** (draft)

Use this checklist when creating the milestone and issues on GitHub. **Target version:** `0.4.1` (codename **Coconut** patch).

## In scope — Milestone **0.4.1**

| Theme | Notes |
|--------|--------|
| **Renderer modularization** | Split overloaded `src/main.js` into logical modules; **done:** `src/app/renderer-bootstrap.js`; **done:** `src/app/modals.js`, `src/app/date-ui.js`. Further splits: settings UI, plugins UI, garden, auth, updater UI. |
| **UI / design system** | Single style standard; **phase 1:** `--cv-*` tokens + `.cv-surface` / `.cv-sheet` in `main.css`. |
| **Tests + CI** | Vitest + `timezone` tests; CI runs `npm run test`. |
| **Electron modularization** | `electron/main.cjs` + `electron/lib/*.cjs`. |

## Out of scope — defer to **0.4.5 – 0.5.0**

| Theme | Notes |
|--------|--------|
| **Cross-platform distribution** | macOS / Linux targets and CI. |

## Suggested GitHub setup

1. Create milestone **0.4.1** with description pointing to `docs/RELEASE_0.4.1.md`.
2. Create milestone **0.4.5** or **0.5.0** for cross-platform packaging.
