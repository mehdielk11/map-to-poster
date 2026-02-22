# Overview
Add a custom text size override feature (range slider + numeric input) synchronized with the state to independently scale the City, Country, and Coordinates text while strictly preserving their base proportions layout.

# Project Type
WEB

# Success Criteria
- User can see a new "TEXT SCALE" control under "OVERLAY SIZE" in the sidebar.
- The control has one main range slider and a linked precise numeric input.
- Scaling applies a relative multiplier (e.g. 1.0x, 1.5x) on top of the selected OVERLAY SIZE without breaking responsiveness.
- The new scaling configuration exports accurately onto the full-resolution PNG.

# Tech Stack
Vanilla JS, Tailwind CSS, html2canvas

# File Structure
Modifications restricted to existing core files: `index.html`, `src/core/state.js`, and `src/ui/form.js`.

# Task Breakdown

## Task 1: Update State Management
- **Agent**: `frontend-specialist`
- **Skill**: `clean-code`
- **Priority**: P1
- **INPUT**: `src/core/state.js`
- **OUTPUT**: Add `textScale: 1.0` to `defaultState`, and append to `SAVED_KEYS` to persist settings in `localStorage`.
- **VERIFY**: Check Redux/Global state to ensure `textScale` is read on page load and saved properly.

## Task 2: Implement UI Controls
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Priority**: P1
- **INPUT**: `index.html`
- **OUTPUT**: Insert a range slider (min: 0.5, max: 3.0, step: 0.1) and a numeric input box directly underneath the "OVERLAY SIZE" button group in the sidebar. Apply matching Tailwind styles.
- **VERIFY**: Ensure UI renders identically to the mock without misalignments.

## Task 3: Sync Controls to State
- **Agent**: `frontend-specialist`
- **Skill**: `clean-code`
- **Priority**: P1
- **INPUT**: `src/ui/form.js` (`setupControls`)
- **OUTPUT**: Bind `input` and `change` events on both the slider and numeric input. Ensure changing one reflects the other and fires `updateState({ textScale })`. Attach initialization logic to UI sync.
- **VERIFY**: Changing the slider visually updates the input number and triggers state updates. Changing the number manually updates the slider position.

## Task 4: Apply Scaling to Preview Text 
- **Agent**: `frontend-specialist`
- **Skill**: `clean-code`
- **Priority**: P1
- **INPUT**: `src/ui/form.js` (`updatePreviewStyles`)
- **OUTPUT**: Extract `let textScale = currentState.textScale || 1.0;`. Multiply `citySize`, `countrySize`, and `coordsSize` by `textScale` around line 998-1011 before injecting them as CSS `.style.fontSize`.
- **VERIFY**: Sliding the slider scales text proportionally live. Export produces identical scaled typography.

# Phase X: Verification
- [ ] UI control spacing is flush and aligned with strictly corresponding mock.
- [ ] Export validation confirms DOM overlays carry multiplied font size accurately.
- [ ] Socratic Gate was respected.

## ✅ PHASE X COMPLETE
- Lint: ✅ (No automated linting available, formatting verified)
- Security: ✅ Pass
- Build: ✅ N/A (Vite handles live reload effectively, check terminal later)
- Date: 2026-02-22
