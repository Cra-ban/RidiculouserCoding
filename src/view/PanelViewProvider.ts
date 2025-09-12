import * as vscode from "vscode";
import { PanelMessageFromExt, PanelMessageToExt, Settings } from "../types";

export class PanelViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "ridiculousCoding.panel";

  private _view?: vscode.WebviewView;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg: PanelMessageToExt) => {
      switch (msg.type) {
        case "ready":
          this.post({
            type: "init",
            settings: this.getSettings(),
            xp: this.context.globalState.get("xp", 0),
            level: this.context.globalState.get("level", 1),
            xpNext: this.context.globalState.get("xpNextAbs", 100)
          });
          break;
        case "toggle":
          this.updateSetting(msg.key, msg.value);
          break;
        case "resetXp":
          vscode.commands.executeCommand("ridiculousCoding.resetXp");
          break;
        case "requestState":
          this.post({
            type: "state",
            xp: this.context.globalState.get("xp", 0),
            level: this.context.globalState.get("level", 1),
            xpNext: this.context.globalState.get("xpNextAbs", 100)
          });
          break;
      }
    });
  }

  post(message: PanelMessageFromExt) {
    this._view?.webview.postMessage(message);
  }

  reveal() {
    this._view?.show?.(true);
  }

  private getSettings(): Settings {
    const cfg = vscode.workspace.getConfiguration("ridiculousCoding");
    return {
      explosions: cfg.get("explosions", true),
      blips: cfg.get("blips", true),
      chars: cfg.get("chars", true),
      shake: cfg.get("shake", true),
      sound: cfg.get("sound", true),
      fireworks: cfg.get("fireworks", true),
      baseXp: cfg.get("leveling.baseXp", 50),
      enableStatusBar: cfg.get("enableStatusBar", true)
    };
  }

  private async updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    const map: Record<string, string> = {
      explosions: "explosions",
      blips: "blips",
      chars: "chars",
      shake: "shake",
      sound: "sound",
      fireworks: "fireworks",
      baseXp: "leveling.baseXp",
      enableStatusBar: "enableStatusBar"
    };
    const configKey = map[key];
    if (!configKey) return;
    await vscode.workspace.getConfiguration("ridiculousCoding").update(configKey, value, true);
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = Math.random().toString(36).slice(2);
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "webview", "panel.css")
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "webview", "panel.js")
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="${cssUri}" rel="stylesheet">
<title>Ridiculous Coding</title>
</head>
<body>
  <section class="toggles">
    <label><input id="explosions" type="checkbox"> Explosions</label>
    <label><input id="blips" type="checkbox"> Blips</label>
    <label><input id="chars" type="checkbox"> Char labels</label>
    <label><input id="shake" type="checkbox"> Shake</label>
    <label><input id="sound" type="checkbox"> Sound</label>
    <label><input id="fireworks" type="checkbox"> Fireworks</label>
  </section>

  <section class="xp">
    <div class="labels">
      <div id="levelLabel">Level: 1</div>
      <div id="xpLabel">XP: 0 / 100</div>
    </div>
    <div class="bar"><div id="barInner"></div></div>
    <div class="row">
      <button id="resetBtn">Reset</button>
      <button id="testFireworks" title="Test fireworks">🎆</button>
    </div>
  </section>

  <canvas id="fwCanvas" class="hidden"></canvas>

  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}