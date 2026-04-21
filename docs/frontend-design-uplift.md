# Frontend Design Uplift

Source of truth for bringing `apps/frontend` in line with DESIGN.md (the Sovereign Grimoire spec).
Run `/critique apps/frontend` to re-score after completing items.

**Critique baseline score:** 17/40

---

## P0 — Foundational (do these first)

- [ ] **Color system** — Replace cyan (`#69b4ff`) + purple (`#d4a7ff`) AI palette with DESIGN.md tokens: oxblood `#800000` primary, ivory `#e2e2e6` body text, warm near-blacks for surfaces. Remove cyan/purple radial gradient from `body`. Apply candle-glow (`#ff8371` at 5% opacity) only on active/focused event element.

- [ ] **Newsreader font** — Load Newsreader from Google Fonts. Apply to section headers, event titles, character names. IBM Plex Sans stays for body; IBM Plex Mono stays for data labels and timestamps.

---

## P1 — Structural

- [ ] **Remove hero metrics** — Delete the 3 KPI cards (Queue Ready / Active Players / API Status) from `play.tsx`. Queue count becomes a small Mono label in the queue panel header. Active event moves front-and-center with candle-glow treatment.

- [ ] **Remove structural glassmorphism** — Replace `backdrop-filter: blur(18px)` on topbar and tabs with solid `surface_container_low` backgrounds. No-Line approach: boundaries from tonal shifts, not blur or borders. Blur is reserved for the Player Panel only (future).

---

## P2 — Interaction

- [ ] **Hold-to-fire confirmation** — Replace direct fire click with two-stage interaction:
  1. Click trigger card → card enters "armed" state, label changes to "Hold to fire"
  2. Hold the button for 1.5–2s → fires the event (CSS `animation-duration` on a progress ring/bar)
  3. Release before threshold → cancels, card returns to ready state
  4. On fire success → card transitions to FIRED state (35% opacity, dashed border, FIRED mono tag in top-right)
  5. On fire failure → inline error copy on the card, card returns to ready state

---

## Minor / Polish

- [ ] **Sharp corners** — Audit and replace `border-radius: 8px` throughout. DESIGN.md allows `none` or `0.125rem` max.
- [ ] **Spacing rhythm** — Normalize spacing scale; `gap` values are inconsistent across components.
- [ ] **Empty states** — Add action-oriented copy to empty states (e.g., "No events ready — create one in Setup to get started").
- [ ] **Border removal** — Audit all `1px solid` borders. Replace with background-color shifts per No-Line rule.

---

## Deferred

- **Player panel redesign** — Health/willpower tracks, Newsreader names, Mono stat labels. Blocked until it's decided what player data lives here. Revisit when real player data is wired.

---

## Notes

- Hold-to-fire is achievable in browser via CSS `transition` on a pseudo-element or clip-path driven by `:active` state + a JS `pointerdown`/`pointerup` timer.
- All color values should be defined as CSS custom properties in `app.css` — no hardcoded hex in component files.
- Re-run `/critique apps/frontend` after P0s are done to check score movement before continuing.
