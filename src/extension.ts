import * as vscode from "vscode";
import { EffectManager } from "./effects/EffectManager";
import { XPService } from "./xp/XPService";
import { PanelViewProvider } from "./view/PanelViewProvider";
import { PanelMessageFromExt, Settings } from "./types";

export function activate(context: vscode.ExtensionContext) {
  const cfg = vscode.workspace.getConfiguration("ridiculousCoding");
  let settings: Settings = {
    explosions: cfg.get("explosions", true),
    blips: cfg.get("blips", true),
    chars: cfg.get("chars", true),
    shake: cfg.get("shake", true),
    sound: cfg.get("sound", true),
    fireworks: cfg.get("fireworks", true),
    baseXp: cfg.get("leveling.baseXp", 50),
    enableStatusBar: cfg.get("enableStatusBar", true),
    reducedEffects: cfg.get("reducedEffects", false)
  };

  const xp = new XPService(context, settings.baseXp);
  const effects = new EffectManager(context);
  const panelProvider = new PanelViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PanelViewProvider.viewType, panelProvider)
  );

  // Status bar
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.command = "ridiculousCoding.showPanel";
  context.subscriptions.push(status);

  function updateStatus() {
    if (!settings.enableStatusBar) {
      status.hide();
      return;
    }
    const prog = xp.progress;
    status.text = `$(rocket) RC Lv ${xp.level} — ${prog.current}/${prog.max} XP`;
    status.tooltip = `Ridiculous Coding\nLevel ${xp.level}\n${prog.current}/${prog.max} XP`;
    status.show();
  }
  updateStatus();

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("ridiculousCoding.showPanel", () => panelProvider.reveal()),
    vscode.commands.registerCommand("ridiculousCoding.resetXp", () => {
      xp.reset();
      pushState();
      updateStatus();
      if (settings.fireworks) {
        post({ type: "fireworks", enabled: settings.sound });
      }
    }),
    vscode.commands.registerCommand("ridiculousCoding.toggleExplosions", () => toggle("explosions")),
    vscode.commands.registerCommand("ridiculousCoding.toggleBlips", () => toggle("blips")),
    vscode.commands.registerCommand("ridiculousCoding.toggleChars", () => toggle("chars")),
    vscode.commands.registerCommand("ridiculousCoding.toggleShake", () => toggle("shake")),
    vscode.commands.registerCommand("ridiculousCoding.toggleSound", () => toggle("sound")),
    vscode.commands.registerCommand("ridiculousCoding.toggleFireworks", () => toggle("fireworks")),
    vscode.commands.registerCommand("ridiculousCoding.toggleReducedEffects", () => toggle("reducedEffects"))
  );

  function toggle<K extends keyof Settings>(key: K) {
    const map: Record<string, string> = {
      explosions: "explosions",
      blips: "blips",
      chars: "chars",
      shake: "shake",
      sound: "sound",
      fireworks: "fireworks",
      baseXp: "leveling.baseXp",
      enableStatusBar: "enableStatusBar",
      reducedEffects: "reducedEffects"
    };
    const configKey = map[key];
    if (!configKey) return;
    const cfg = vscode.workspace.getConfiguration("ridiculousCoding");
    const newVal = !(settings[key] as any as boolean);
    cfg.update(configKey, newVal, true);
  }

  // React to configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration("ridiculousCoding")) return;
      const cfg = vscode.workspace.getConfiguration("ridiculousCoding");
      const oldReducedEffects = settings.reducedEffects;
      settings = {
        explosions: cfg.get("explosions", true),
        blips: cfg.get("blips", true),
        chars: cfg.get("chars", true),
        shake: cfg.get("shake", true),
        sound: cfg.get("sound", true),
        fireworks: cfg.get("fireworks", true),
        baseXp: cfg.get("leveling.baseXp", 50),
        enableStatusBar: cfg.get("enableStatusBar", true),
        reducedEffects: cfg.get("reducedEffects", false)
      };
      
      // If reduced effects was just enabled, clear all decorations
      if (!oldReducedEffects && settings.reducedEffects) {
        vscode.window.visibleTextEditors.forEach(editor => {
          effects.clearAllDecorations(editor);
        });
      }
      
      xp.setBaseXp(settings.baseXp);
      pushState();
      updateStatus();
      // Re-send init with new settings
      post({
        type: "init",
        settings,
        xp: xp.xp,
        level: xp.level,
        xpNext: xp.xpNextAbs,
        xpLevelStart: xp.xpStartOfLevel
      });
    })
  );

  // Pitch increase like the original (decays over time)
  let pitchIncrease = 0;
  let lastDecay = Date.now();
  const PITCH_DECREMENT = 2.0 / 1000; // per ms
  setInterval(() => {
    const now = Date.now();
    const dt = now - lastDecay;
    lastDecay = now;
    if (pitchIncrease > 0) {
      pitchIncrease = Math.max(0, pitchIncrease - dt * PITCH_DECREMENT);
    }
  }, 50);

  // Event handling: typing, deleting, newline
  let lastLineByEditor = new WeakMap<vscode.TextEditor, number>();

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(evt => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || evt.document !== editor.document) return;

      const change = evt.contentChanges[0];
      if (!change) return;

      // Classify
      const insertedText = change.text ?? "";
      const removedChars = change.rangeLength ?? 0;
      const isInsert = insertedText.length > 0;
      const isDelete = !isInsert && removedChars > 0;

      const caret = editor.selection.active;
      // Character label from inserted text (first char) or delete symbol
      const charLabel =
        isInsert && settings.chars
          ? sanitizeLabel(insertedText[0] ?? "")
          : isDelete && settings.chars
          ? "⌫"
          : undefined;

      if (isInsert && settings.blips && !settings.reducedEffects) {
        effects.showBlip(editor, settings.chars, settings.shake, charLabel);
        pitchIncrease += 1.0;
        // Sound via panel (disabled in reduced effects mode)
        post({ type: "blip", pitch: 1.0 + pitchIncrease * 0.05, enabled: settings.sound && !settings.reducedEffects });
        // XP (always gained, even in reduced effects)
        const leveled = xp.addXp(1);
        if (leveled && settings.fireworks && !settings.reducedEffects) post({ type: "fireworks", enabled: settings.sound && !settings.reducedEffects });
        pushState();
        updateStatus();
      } else if (isInsert) {
        // Still gain XP even in reduced effects mode
        const leveled = xp.addXp(1);
        pushState();
        updateStatus();
      } else if (isDelete && settings.explosions && !settings.reducedEffects) {
        effects.showBoom(editor, settings.chars, settings.shake, charLabel);
        post({ type: "boom", enabled: settings.sound && !settings.reducedEffects });
        pushState();
      }

      // Newline detection within this change (also disabled in reduced effects)
      if (settings.blips && insertedText.includes("\n") && !settings.reducedEffects) {
        effects.showNewline(editor, settings.shake);
      }

      // Track line change between events for additional newline cues
      lastLineByEditor.set(editor, caret.line);
    }),

    vscode.window.onDidChangeTextEditorSelection(e => {
      const editor = e.textEditor;
      const last = lastLineByEditor.get(editor);
      const now = editor.selection.active.line;
      if (last !== undefined && now !== last && settings.blips && !settings.reducedEffects) {
        effects.showNewline(editor, settings.shake);
      }
      lastLineByEditor.set(editor, now);
    })
  );

  function sanitizeLabel(ch: string): string {
    if (ch === "\n") return "⏎";
    if (ch === "\t") return "↹";
    if (ch.trim() === "") return "•";
    return ch;
  }

  function post(msg: PanelMessageFromExt) {
    panelProvider.post(msg);
  }

  function pushState() {
    post({ type: "state", xp: xp.xp, level: xp.level, xpNext: xp.xpNextAbs, xpLevelStart: xp.xpStartOfLevel });
  }

  // Send initial state when view appears
  setTimeout(() => {
    post({
      type: "init",
      settings,
      xp: xp.xp,
      level: xp.level,
      xpNext: xp.xpNextAbs,
      xpLevelStart: xp.xpStartOfLevel
    });
  }, 500);
}

export function deactivate() {
  // no-op
}