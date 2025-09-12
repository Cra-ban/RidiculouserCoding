# End-to-End Development Plan: “Ridiculous Coding” VS Code Extension

Credits:
- Original Godot plugin “ridiculous_coding” by John Watson: https://github.com/jotson/ridiculous_coding
- Inspired by Textreme2 by Ash K: https://ash-k.itch.io/textreme-2

This document outlines a complete plan to recreate the core, user-visible experience of the Godot plugin as a Visual Studio Code extension, within VS Code’s extension API constraints.

---

## 1) Goals and Scope

- Goals (feature parity in VS Code terms):
  - Typing blips: animated visual at the caret, optional sound, optional label of last character, subtle shake.
  - Delete booms: explosion visual, optional sound, optional label, stronger shake.
  - Newline effect: visual when caret moves to a new line.
  - Gamification: XP gain per keystroke, level progression, fireworks on level up, persisted XP/level, reset button.
  - Docked controls: toggles for explosions, blips, chars (labels), shake, sound, fireworks; XP/Level display and progress bar.
- Non-goals and constraints:
  - Do not modify VS Code internals or window position; true “screen shake” is not supported. Approximate with decorative jitter.
  - Keep performance acceptable at fast typing rates (120+ WPM).

---

## 2) Feature Mapping to VS Code Capabilities

- Visual effects at caret:
  - Use `TextEditorDecorationType` with `renderOptions.before/after` (e.g., `contentIconPath`, `contentText`).
  - For animations: short‑lived decorations (flash) and optional frame updates, but prefer simple static images (SVG/GIF/APNG) for performance.
- Sound:
  - Use a persistent `WebviewView` panel to host Web Audio and play SFX on extension messages.
- “Screen shake” approximation:
  - Jitter decorations by alternating small left/right margins for a brief duration, not window movement.
- XP and level:
  - Store in `globalState` (Memento). Display in Status Bar and panel.
- Docked controls:
  - A contributed `WebviewView` (Explorer sidebar) for toggles, XP/Level, progress, reset, and fireworks.

---

## 3) Architecture Overview

- Extension Host (TypeScript/Node):
  - Activation and event wiring:
    - `workspace.onDidChangeTextDocument` for edits (insert/delete detection).
    - `window.onDidChangeTextEditorSelection` for line transitions.
  - EffectManager:
    - Creates, applies, and clears decorations.
    - Provides jitter-based shake approximation.
  - XPService:
    - Implements leveling curve; persists `xp`, `level`, `xpNextAbs`, and start-of-level.
  - SettingsService:
    - Reads/writes configuration from `contributes.configuration`; pushes updates to panel.
  - AudioBridge:
    - Sends messages to webview to play SFX (blip, boom, fireworks) with parameters (pitch).
  - PanelView (WebviewView):
    - Renders toggles, XP progress, level, reset button, and fireworks animation.
- Media:
  - Lightweight SVG icons for caret effects.
  - Web Audio synthesis for SFX initially; later can swap to bundled OGG/MP3.

---

## 4) Detailed Implementation Plan (Phased)

### Phase 0 — Scaffolding and Foundations
- Initialize extension with TypeScript scaffold (`yo code` or manual).
- Repo structure:
  - `src/extension.ts`, `src/effects/`, `src/xp/`, `src/view/`, `src/types.ts`
  - `media/` (SVGs, icons), `webview/` (panel.css, panel.js), `README.md`, `LICENSE`
- `package.json` contributions:
  - `activationEvents`, `contributes.configuration`, `contributes.views`, `contributes.commands`
- MIT license and README with credits.

### Phase 1 — Typing “Blip” MVP
- Event detection:
  - On text insertion, compute caret position and last character inserted.
  - Maintain a simple “pitchIncrease” accumulator; decay over time on an interval.
- Visual:
  - Apply a blip decoration at caret with brief lifetime (100–150 ms).
  - Optional label rendering via `contentText`.
- Sound:
  - Post `blip` message with pitch to webview; play short tone (triangle wave) with Web Audio.
- XP:
  - +1 XP per insertion; status bar shows “RC Lv X — Y/Z XP”.
- Settings:
  - `blips`, `chars`, `sound`, `shake`.

### Phase 2 — Delete “Boom” and Newline Effect
- Delete classification:
  - If change is deletion (`rangeLength > 0` and no inserted text), trigger boom.
  - Larger decoration, random-colored label (⌫) if `chars=true`.
  - Stronger shake via jitter.
  - Post `boom` to webview; play noise burst.
- Newline:
  - Detect inserted `\n` or line number change; show newline decoration and subtle shake.

### Phase 3 — Panel (Dock) with Toggles, XP UI, Fireworks
- WebviewView in the Explorer:
  - Toggles: `explosions`, `blips`, `chars`, `shake`, `sound`, `fireworks`.
  - XP UI: level label, XP label, progress bar, reset button.
  - Bidirectional messaging for state sync.
- Level-up:
  - When leveling occurs, post `fireworks`; webview shows canvas fireworks and celebratory beep if `sound=true`.

### Phase 4 — Polish and Performance
- Pitch decay tuning and rate-limiting for blips/booms (e.g., 20 ms/100 ms).
- Cap concurrent active decorations; ensure cleanup to avoid leaks.
- Multi-editor support; cleanup on editor close/visibility change.
- Accessibility: allow “reduced effects” by disabling visuals quickly.

---

## 5) User-Visible Configuration (Settings)

Namespace: `ridiculousCoding`

- `explosions: boolean` — Show delete explosions. Default: `true`
- `blips: boolean` — Show typing/newline blips. Default: `true`
- `chars: boolean` — Show last key/character labels. Default: `true`
- `shake: boolean` — Jitter effects to emulate shake. Default: `true`
- `sound: boolean` — Play SFX. Default: `true`
- `fireworks: boolean` — Celebrate level-ups. Default: `true`
- `leveling.baseXp: number` — Base XP for curve. Default: `50`
- `enableStatusBar: boolean` — Show status bar XP. Default: `true`

---

## 6) XP and Leveling Model (Match Original)

- Constants:
  - `BASE_XP = 50`
  - Initial target: `xpNextAbs = 2 * BASE_XP = 100`
- On each keystroke: `xp += 1`
- Level up when `xp >= xpNextAbs`:
  - `level += 1`
  - Set level start to current `xp`
  - `xpNextAbs = xp + round(BASE_XP * level / 10) * 10`
  - Trigger fireworks if enabled
- Persistence:
  - `globalState`: `xp`, `level`, `xpNextAbs`, and `xpLevelStart`
  - Reset sets `(level=1, xp=0, xpNextAbs=100)`

---

## 7) Assets and UX

- Visuals:
  - Blip: small burst icon (SVG)
  - Boom: larger starburst/explosion (SVG)
  - Newline: arrow/swoosh (SVG)
  - Fireworks: canvas particles in panel
- Labels (chars):
  - Show first inserted character; map `\n` → “⏎”, `\t` → “↹”, whitespace → “•”, delete → “⌫”
- Sounds:
  - Synthesized with Web Audio (triangle beep, filtered noise burst); later can bundle audio

---

## 8) Commands and UI

- Commands:
  - Ridiculous Coding: Show Panel
  - Ridiculous Coding: Reset XP
  - Ridiculous Coding: Toggle Explosions
  - Ridiculous Coding: Toggle Blips
  - Ridiculous Coding: Toggle Char Labels
  - Ridiculous Coding: Toggle Shake
  - Ridiculous Coding: Toggle Sound
  - Ridiculous Coding: Toggle Fireworks
- Status Bar:
  - “RC Lv X — Y/Z XP”; click opens the panel.

---

## 9) Testing Plan

- Unit Tests (Mocha/Chai or Vitest):
  - XPService: thresholds, level-ups, resets, persistence interactions.
- Integration (vscode-test):
  - Simulate insert/delete/newline; assert decoration applications and lifetimes.
  - Verify settings toggles suppress effects/sounds when disabled.
  - Webview state sync on init and config changes.
- Manual:
  - Pitch cadence/decay feel; rapid typing performance; level-up fireworks behavior.

---

## 10) Performance and Safety

- Throttle effects (min intervals) and cap concurrent decorations.
- Dispose `TextEditorDecorationType` instances; reuse as feasible.
- Avoid heavy logic in change handlers; use `setTimeout` for brief animations.
- Debounce configuration updates.
- Respect user preferences (sounds off, reduced effects).

---

## 11) Documentation

- README:
  - Feature overview and screenshots/GIFs.
  - Installation (from VSIX/Marketplace) and quick start.
  - Settings reference and known limitations (no real window shake).
  - Credits to original creators (John Watson, Ash K).
- Changelog adhering to SemVer.
- Contribution guidelines (optional).

---

## 12) Packaging and Publishing

- Build:
  - `npm run compile` and `vsce package`
- Marketplace:
  - Public listing with icon, keywords, GIF previews.
  - Categories: “Other”
  - Keywords: “fun, gamification, effects, typing, fireworks”
- License: MIT

---

## 13) Timeline and Milestones (Example 4 Weeks)

- Week 1:
  - Scaffold, settings, status bar, XPService.
  - Typing blip MVP (visual + webview beep).
- Week 2:
  - Delete boom + newline effects; pitch cadence/decay.
  - Webview panel with toggles and XP UI.
- Week 3:
  - Fireworks celebration; shake approximation polish.
  - Performance tuning; initial tests.
- Week 4:
  - Documentation, assets polish, QA.
  - Package and publish.

---

## 14) Risks and Mitigations

- Sound playback reliability:
  - Keep webview persistent; pre-warm audio context on user interaction.
- Animation smoothness:
  - Prefer static SVG/GIF flash over frame-swapping; cap concurrent effects.
- API limitations:
  - Communicate shake limitations clearly; provide on/off toggle.
- Cross-platform differences:
  - Test on Windows/macOS/Linux; verify audio behavior and font metrics.

---

## 15) Definition of Done

- Blip, boom, and newline visuals implemented with optional labels and sounds.
- XP accrual, level progression, fireworks on level-up; reset behavior.
- Toggles persisted via settings; panel reflects and controls state live.
- Status bar XP display (optional).
- Performance remains smooth under fast typing; no decoration leaks.
- Documentation complete; Marketplace package ready; credits included.

---

## Appendix: Initial Scaffold Checklist

- [ ] `package.json` with contributions (views, commands, configuration)
- [ ] `src/extension.ts` with event wiring, settings handling
- [ ] `src/effects/EffectManager.ts` (decorations + shake)
- [ ] `src/xp/XPService.ts` (leveling logic)
- [ ] `src/view/PanelViewProvider.ts` + `webview/panel.css` + `webview/panel.js`
- [ ] `media/` SVGs for blip, boom, newline; extension icon
- [ ] `README.md` and `LICENSE` (MIT) with credits
- [ ] Build scripts (`tsconfig.json`, npm scripts)
- [ ] Basic tests (optional in MVP, planned in Week 3)

```bash
# Dev workflow
npm install
npm run watch
# Press F5 in VS Code to launch the Extension Host (debug)
```
