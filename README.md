# Ridiculous Coding (VS Code)

It makes your coding experience 1000x more ridiculous:
- Blips when typing (visuals, optional SFX, optional char labels, subtle shake)
- Booms when deleting (bigger visuals, optional SFX, stronger shake)
- Newline animation
- XP and levels with fireworks on level up
- Docked panel with toggles and progress; XP persists

## Credits

This VS Code extension is inspired by and recreates the experience of:
- Original Godot plugin "ridiculous_coding" by John Watson: https://github.com/jotson/ridiculous_coding
- Inspired by Textreme2 by Ash K: https://ash-k.itch.io/textreme-2

## Quick start
1. `npm install`
2. Press F5 to start the Extension Host.
3. In the Explorer sidebar, open the “Ridiculous Coding” view (or run “Ridiculous Coding: Show Panel”).
4. Start typing!

## Settings
See Settings → Extensions → Ridiculous Coding:
- `ridiculousCoding.explosions` (default: true)
- `ridiculousCoding.blips` (default: true)
- `ridiculousCoding.chars` (default: true)
- `ridiculousCoding.shake` (default: true)
- `ridiculousCoding.sound` (default: true)
- `ridiculousCoding.fireworks` (default: true)
- `ridiculousCoding.leveling.baseXp` (default: 50)
- `ridiculousCoding.enableStatusBar` (default: true)
- `ridiculousCoding.reducedEffects` (default: false) — **Accessibility**: Disable all visual and sound effects when enabled. XP progression still works.

## Accessibility
For users who need reduced visual effects or find the animations distracting, enable `ridiculousCoding.reducedEffects`. This setting:
- Disables all visual decorations (blips, booms, newline animations, shake effects)
- Mutes all sounds (blips, booms, fireworks)
- Keeps XP progression working normally
- Can be toggled via the panel or VS Code settings

## Notes
- “Shake” is approximated by jittering decorations; VS Code doesn’t allow moving the window/editor.
- Sounds are synthesized via Web Audio in the panel (no binaries).
## Performance & Multi-Editor Support
- Effects are rate-limited per editor (blips: 20ms, booms: 100ms) for performance.
- Concurrent decorations are capped per editor to prevent memory leaks.
- Multi-editor support: effects and XP work independently across multiple open editors.
- Decorations are properly cleaned up when editors close or lose visibility.
