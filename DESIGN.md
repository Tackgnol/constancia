# Design System Document: The Nocturnal Strategist

## 1. Overview & Creative North Star: The Sovereign Grimoire

The objective of this design system is to reconcile the ancient, blood-stained history of the Kindred with the cold, calculated efficiency of a modern tactical command center. We are moving away from "game UI" tropes—no heavy skeuomorphism, no glowing red buttons. Instead, we are building a **Sovereign Grimoire**.

This system utilizes high-contrast editorial typography and extreme tonal depth to manage high information density. We achieve a "premium" feel through intentional asymmetry and a "No-Line" philosophy, where the architecture of the screen is defined by shadows and light (glows), rather than rigid borders.

### The Creative North Star

**"The Digital Curator of Chaos."**
The interface should feel like an expensive, leather-bound ledger that has been retrofitted with state-of-the-art surveillance tech. It is sophisticated, authoritative, and whisper-quiet until the moment of action.

---

## 2. Colors & Atmospheric Depth

### Surface Hierarchy & Nesting

We reject the flat web. This system uses a "Step-Down" layering technique.

- **The Base:** Use `surface_container_lowest` (#0c0e11) for the primary application canvas.
- **The Workspaces:** Use `surface` (#121317) for large functional areas (e.g., the Event Queue container).
- **The Elements:** Use `surface_container` or `surface_container_high` for individual cards.

**The "No-Line" Rule:**
1px solid borders are strictly prohibited for sectioning content. Boundaries must be defined by background color shifts. A `surface_container_high` card sitting on a `surface` background provides enough contrast for the eye without creating visual noise.

**The "Candle-Glow" Execution:**
For the "Current Event" or active focus, apply a radial gradient glow using `on_primary_container` (#ff8371) at 5% opacity, centered behind the element. This mimics the warm, uneven light of a candle on a dark desk.

**Glass & Gradients:**
Floating panels (like the Player Panel) should utilize `surface_variant` with a 0.8 alpha and a 12px backdrop-blur. This ensures the "film grain" of the background remains visible, maintaining the cinematic atmosphere.

---

## 3. Typography: The Editorial Weight

Our typography is the primary driver of hierarchy, replacing the need for "rainbow" color-coding.

- **Display & Headlines (Newsreader):** Use for character names, major event titles, and section headers. Its historical serif weight provides the "Grimoire" feel.
  - _Style:_ Optical sizing should be aggressive; use `display-lg` for impactful moments.
- **Body & Narrative (IBM Plex Sans):** Use for "Narrations" and "DM Notes." It is the invisible workhorse.
  - _Constraint:_ Never use pure white. Use `on_surface` (#e2e2e6) for high legibility with reduced eye strain.
- **Data & Labels (IBM Plex Mono):** This is the "Tactical" seasoning. Use for "Tests," "Difficulty Ratings," and "Timestamps."
  - _Implementation:_ All caps with 0.05em letter spacing for `label-sm`.

### Type-Based Block Differentiation

Use typography, a written type label, and restrained system-color tints together. Color speeds up
live scanning, but it must never be the only state signal:

- **Tests:** `label-md` (Mono) + blue (#58a6ff).
- **Narrations:** `body-lg` (Sans) + Italic + purple (#d2a8ff).
- **Insights:** `title-sm` (Sans) + green (#3fb950).
- **DMs:** `body-sm` (Sans) + Uppercase + orange (#f0883e).

---

## 4. Elevation & Tonal Layering

### The Layering Principle

Depth is achieved by "stacking" tones.

1. **Background:** `surface_container_lowest`
2. **Section:** `surface_container_low`
3. **Card:** `surface_container`
4. **Active Element:** `surface_bright`

### Ambient Shadows

When an element must "float" (e.g., a context menu), use a shadow:

- **Y-Offset:** 8px | **Blur:** 24px
- **Color:** `surface_container_lowest` at 60% opacity.
- _Note:_ Do not use pitch-black shadows; use the tinted background color to maintain the "warm near-black" atmosphere.

### The "Ghost Border"

For the "War Room" aesthetic, use a "Ghost Border" for interactive but secondary elements: `outline_variant` (#5a413d) at 20% opacity. This provides a tactile hint without breaking the "No-Line" rule.

---

## 5. Components

### The Event Card (Ready State)

- **Background:** `surface_container_high`
- **Corner Radius:** `sm` (0.125rem) for a sharp, technical look.
- **Interaction:** On hover, shift background to `surface_container_highest`. No border change.

### The "Fired" State (Spent Events)

- **Opacity:** 35% across the entire component.
- **Border:** 1px dashed `outline`.
- **Status Overlay:** A `label-sm` (Mono) tag in the top-right reading "FIRED".
- **Grayscale:** Apply a `grayscale(50%)` filter to any images/icons within.

### Soundboard Grid (The "Artifact" Layout)

Avoid a standard square grid. Use variable card sizes (1x1, 2x1, 1x2) to create an intentional, asymmetric "scattered" look.

- Use `primary_container` (#800000) for the background of high-impact sounds.
- Use `tertiary_container` (#423c30) for ambient loops.

### Input Fields & Buttons

- **Buttons:** Use `primary_container` for the fill. Text must be `on_primary_container`.
- **Shape:** `none` (0px) for a brutalist, tactical feel.
- **Inputs:** No bottom line. Use a `surface_container_highest` fill with a `label-sm` (Mono) floating label in `outline` color.

---

## 6. Do's and Don'ts

### Do

- **Use Vertical Space:** Use the `xl` spacing scale to separate the "Current Event" from the "Event Queue." Breathing room is luxury.
- **Embrace the Grain:** Apply a subtle noise texture (SVG filter) to the `background` to prevent digital banding.
- **Vary Type Weights:** Use the contrast between Newsreader Medium and IBM Plex Mono Regular to define importance.

### Don't

- **Don't use decorative rainbow colors:** Reserve blue, purple, green, and orange for the four event classes above. Use ivory (`on_surface`), oxblood (`primary`), and gold-grey (`tertiary`) elsewhere.
- **Don't use Rounded Corners:** Avoid `xl` or `full` roundedness. Stick to `none` or `sm`. This is a war room, not a social media app.
- **Don't use Dividers:** If you feel the need to draw a line, increase the padding and change the background color of the next section instead.

---

## 7. Signature Elements: The Player Panel

The Player Panel should be a permanent "Glass" fixture on the right margin.

- **Surface:** `surface_variant` (80% Opacity) + Backdrop Blur.
- **Hierarchy:** Health and Willpower tracks should use `primary` (Oxblood) and `tertiary` (Gold-Grey) segments respectively.
- **Typography:** Names in `headline-sm` (Newsreader). Stat labels in `label-sm` (Mono).

This system is designed to be felt as much as it is used. Every interaction should feel like a calculated move in a high-stakes shadow war.

---

## 8. Product Workbenches

### NPC Dossier

Use an index-and-canvas master-detail layout for GM-owned records. The index stays compact and
identifies the selected record through surface contrast and an explicit pressed state. The focused
canvas leads with identity, classification, and one operational summary. Do not duplicate the same
biography in a second panel.

Evidence counts belong in one compact definition ledger, not three independent statistic cards.
Player access belongs in full-width rows containing identity, access count, and one action. On small
screens, the portrait is capped at 17rem and access rows stack without horizontal scrolling.

### Editorial Forms

Setup forms use a two-column editorial canvas above 860px and collapse to one column below it.
Every cell must contain an editable field, a short explanation, or an action; long-form inputs span
the full grid. Use object-specific labels such as “Create quest,” “Save lore entry,” and “Delete
dossier.” Avoid generic “Add,” “Save,” “Delete,” and “Close” when the affected object is not obvious.

### Action Dock

Primary form actions live in a tonal dock at the end of the document flow. The dock must never
overlay editable content. Pair one primary submit action with optional secondary or destructive
actions, keeping the primary control highest contrast. Save-state text uses `aria-live` and remains
adjacent to the submit control.

### Responsive Editor Rules

- Block headers use `minmax(0, 1fr)` for the selector and a 44px icon action on narrow screens.
- Multi-field outcome rows stack their inputs before allowing horizontal overflow.
- All interactive controls retain a minimum 44px target.
- Product motion is limited to 120–200ms state feedback and respects reduced-motion preferences.
- Demo routes must expose the same core records as the surrounding demo shell; empty states are
  reserved for genuinely empty campaign data.
