export type Settings = {
  explosions: boolean;
  blips: boolean;
  chars: boolean;
  shake: boolean;
  sound: boolean;
  fireworks: boolean;
  baseXp: number;
  enableStatusBar: boolean;
  reducedEffects: boolean;
};

export type PanelMessageFromExt =
  | { type: "init"; settings: Settings; xp: number; level: number; xpNext: number; xpLevelStart: number }
  | { type: "state"; xp: number; level: number; xpNext: number; xpLevelStart: number }
  | { type: "blip"; pitch: number; enabled: boolean }
  | { type: "boom"; enabled: boolean }
  | { type: "fireworks"; enabled: boolean };

export type PanelMessageToExt =
  | { type: "ready" }
  | { type: "toggle"; key: keyof Settings; value: boolean }
  | { type: "resetXp" }
  | { type: "requestState" };