import * as vscode from "vscode";

type EffectKind = "blip" | "boom" | "newline";

// Per-editor state for rate limiting and decoration tracking
interface EditorState {
  lastBlipAt: number;
  lastBoomAt: number;
  activeDecorations: {
    blip: number;
    boom: number;
    newline: number;
  };
}

export class EffectManager {
  private context: vscode.ExtensionContext;
  private blipDecoration: vscode.TextEditorDecorationType;
  private boomDecoration: vscode.TextEditorDecorationType;
  private newlineDecoration: vscode.TextEditorDecorationType;

  // Jitter variants to approximate "shake"
  private jitterLeft: vscode.TextEditorDecorationType;
  private jitterRight: vscode.TextEditorDecorationType;

  // Per-editor state tracking
  private editorStates = new WeakMap<vscode.TextEditor, EditorState>();
  
  // Maximum concurrent decorations per effect type per editor
  private readonly MAX_DECORATIONS_PER_TYPE = 5;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    const media = vscode.Uri.joinPath(this.context.extensionUri, "media");
    const blipIcon = vscode.Uri.joinPath(media, "blip.svg");
    const boomIcon = vscode.Uri.joinPath(media, "boom.svg");
    const newlineIcon = vscode.Uri.joinPath(media, "newline.svg");

    this.blipDecoration = vscode.window.createTextEditorDecorationType({
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      after: {
        contentIconPath: blipIcon,
        margin: "0 0 0 2px"
      }
    });

    this.boomDecoration = vscode.window.createTextEditorDecorationType({
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      after: {
        contentIconPath: boomIcon,
        margin: "0 0 0 2px"
      }
    });

    this.newlineDecoration = vscode.window.createTextEditorDecorationType({
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      after: {
        contentIconPath: newlineIcon,
        margin: "0 0 0 2px"
      }
    });

    this.jitterLeft = vscode.window.createTextEditorDecorationType({
      after: { margin: "0 0 0 -2px" }
    });
    this.jitterRight = vscode.window.createTextEditorDecorationType({
      after: { margin: "0 0 0 2px" }
    });

    // Set up cleanup on editor close
    context.subscriptions.push(
      vscode.window.onDidChangeVisibleTextEditors(editors => {
        // Clean up state for editors that are no longer visible
        this.cleanupInvisibleEditors(editors);
      })
    );
  }

  dispose() {
    this.blipDecoration.dispose();
    this.boomDecoration.dispose();
    this.newlineDecoration.dispose();
    this.jitterLeft.dispose();
    this.jitterRight.dispose();
  }

  private getEditorState(editor: vscode.TextEditor): EditorState {
    let state = this.editorStates.get(editor);
    if (!state) {
      state = {
        lastBlipAt: 0,
        lastBoomAt: 0,
        activeDecorations: {
          blip: 0,
          boom: 0,
          newline: 0
        }
      };
      this.editorStates.set(editor, state);
    }
    return state;
  }

  private cleanupInvisibleEditors(visibleEditors: readonly vscode.TextEditor[]) {
    // This is a simple cleanup - more sophisticated cleanup would require 
    // tracking all editors we've seen, but WeakMap handles memory automatically
    // when editors are garbage collected
  }

  private canAddDecoration(editor: vscode.TextEditor, kind: EffectKind): boolean {
    const state = this.getEditorState(editor);
    return state.activeDecorations[kind] < this.MAX_DECORATIONS_PER_TYPE;
  }

  private caretRange(editor: vscode.TextEditor): vscode.Range {
    const pos = editor.selection.active;
    return new vscode.Range(pos, pos);
  }

  private applyOnce(editor: vscode.TextEditor, kind: EffectKind, label?: string) {
    if (!this.canAddDecoration(editor, kind)) {
      return; // Skip if too many decorations
    }

    const range = this.caretRange(editor);
    const dec = (kind === "blip" ? this.blipDecoration : kind === "boom" ? this.boomDecoration : this.newlineDecoration);

    // Build render options with optional text label via "renderOptions" at runtime
    const opt: vscode.DecorationOptions = {
      range,
      renderOptions: label
        ? {
            after: {
              contentText: ` ${label} `,
              color: `hsl(${Math.floor(Math.random() * 360)}, 90%, 65%)`,
              fontWeight: "bold"
            }
          }
        : {}
    };

    editor.setDecorations(dec, [opt]);

    // Track active decoration
    const state = this.getEditorState(editor);
    state.activeDecorations[kind]++;

    // Clear shortly after to simulate animation flash
    setTimeout(() => {
      try {
        editor.setDecorations(dec, []);
        // Decrement counter
        const currentState = this.getEditorState(editor);
        currentState.activeDecorations[kind] = Math.max(0, currentState.activeDecorations[kind] - 1);
      } catch {
        // no-op - editor might have been disposed
      }
    }, kind === "boom" ? 250 : 120);
  }

  private shake(editor: vscode.TextEditor, durationMs: number) {
    const range = this.caretRange(editor);
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      if (elapsed > durationMs) {
        editor.setDecorations(this.jitterLeft, []);
        editor.setDecorations(this.jitterRight, []);
        return;
      }
      const which = Math.random() > 0.5 ? this.jitterLeft : this.jitterRight;
      const other = which === this.jitterLeft ? this.jitterRight : this.jitterLeft;
      editor.setDecorations(other, []);
      editor.setDecorations(which, [{ range }]);
      setTimeout(tick, 16);
    };
    tick();
  }

  showBlip(editor: vscode.TextEditor, showChars: boolean, shake?: boolean, charLabel?: string) {
    const state = this.getEditorState(editor);
    const now = Date.now();
    if (now - state.lastBlipAt < 20) return; // Rate limit per editor
    state.lastBlipAt = now;
    this.applyOnce(editor, "blip", showChars ? charLabel : undefined);
    if (shake) this.shake(editor, 50);
  }

  showBoom(editor: vscode.TextEditor, showChars: boolean, shake?: boolean, charLabel?: string) {
    const state = this.getEditorState(editor);
    const now = Date.now();
    if (now - state.lastBoomAt < 100) return; // Rate limit per editor
    state.lastBoomAt = now;
    this.applyOnce(editor, "boom", showChars ? charLabel : undefined);
    if (shake) this.shake(editor, 200);
  }

  showNewline(editor: vscode.TextEditor, shake: boolean) {
    this.applyOnce(editor, "newline");
    if (shake) this.shake(editor, 50);
  }

  // Method to clean up all decorations for an editor (useful for reduced effects)
  clearAllDecorations(editor: vscode.TextEditor) {
    try {
      editor.setDecorations(this.blipDecoration, []);
      editor.setDecorations(this.boomDecoration, []);
      editor.setDecorations(this.newlineDecoration, []);
      editor.setDecorations(this.jitterLeft, []);
      editor.setDecorations(this.jitterRight, []);
      
      // Reset decoration counts
      const state = this.getEditorState(editor);
      state.activeDecorations = { blip: 0, boom: 0, newline: 0 };
    } catch {
      // no-op - editor might have been disposed
    }
  }
}