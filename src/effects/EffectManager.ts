import * as vscode from "vscode";

type EffectKind = "blip" | "boom" | "newline";

export class EffectManager {
  private context: vscode.ExtensionContext;
  private blipDecoration: vscode.TextEditorDecorationType;
  private boomDecoration: vscode.TextEditorDecorationType;
  private newlineDecoration: vscode.TextEditorDecorationType;

  // Jitter variants to approximate "shake"
  private jitterLeft: vscode.TextEditorDecorationType;
  private jitterRight: vscode.TextEditorDecorationType;

  private lastBlipAt = 0;
  private lastBoomAt = 0;

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
  }

  dispose() {
    this.blipDecoration.dispose();
    this.boomDecoration.dispose();
    this.newlineDecoration.dispose();
    this.jitterLeft.dispose();
    this.jitterRight.dispose();
  }

  private caretRange(editor: vscode.TextEditor): vscode.Range {
    const pos = editor.selection.active;
    return new vscode.Range(pos, pos);
  }

  private applyOnce(editor: vscode.TextEditor, kind: EffectKind, label?: string) {
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

    // Clear shortly after to simulate animation flash
    setTimeout(() => {
      try {
        editor.setDecorations(dec, []);
      } catch {
        // no-op
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
    const now = Date.now();
    if (now - this.lastBlipAt < 20) return;
    this.lastBlipAt = now;
    this.applyOnce(editor, "blip", showChars ? charLabel : undefined);
    if (shake) this.shake(editor, 50);
  }

  showBoom(editor: vscode.TextEditor, showChars: boolean, shake?: boolean, charLabel?: string) {
    const now = Date.now();
    if (now - this.lastBoomAt < 100) return;
    this.lastBoomAt = now;
    this.applyOnce(editor, "boom", showChars ? charLabel : undefined);
    if (shake) this.shake(editor, 200);
  }

  showNewline(editor: vscode.TextEditor, shake: boolean) {
    this.applyOnce(editor, "newline");
    if (shake) this.shake(editor, 50);
  }
}