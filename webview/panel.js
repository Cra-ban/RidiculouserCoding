(function () {
  const vscode = acquireVsCodeApi();

  const els = {
    explosions: document.getElementById("explosions"),
    blips: document.getElementById("blips"),
    chars: document.getElementById("chars"),
    shake: document.getElementById("shake"),
    sound: document.getElementById("sound"),
    fireworks: document.getElementById("fireworks"),
    reducedEffects: document.getElementById("reducedEffects"),
    levelLabel: document.getElementById("levelLabel"),
    xpLabel: document.getElementById("xpLabel"),
    barInner: document.getElementById("barInner"),
    resetBtn: document.getElementById("resetBtn"),
    testFireworks: document.getElementById("testFireworks"),
    fwCanvas: document.getElementById("fwCanvas")
  };

  // Web Audio setup
  let audioCtx;
  const ensureAudio = () => {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  };

  function playBeep(pitch = 1.0) {
    try {
      const actx = ensureAudio();
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = "triangle";
      o.frequency.value = 440 * pitch;
      g.gain.value = 0.03;
      o.connect(g).connect(actx.destination);
      o.start();
      o.stop(actx.currentTime + 0.08);
    } catch {}
  }

  function playExplosion() {
    try {
      const actx = ensureAudio();
      const bufferSize = 2 * actx.sampleRate;
      const noiseBuffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // decay
      }
      const whiteNoise = actx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = actx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1000;

      const gain = actx.createGain();
      gain.gain.value = 0.05;

      whiteNoise.connect(filter).connect(gain).connect(actx.destination);
      whiteNoise.start();
      whiteNoise.stop(actx.currentTime + 0.2);
    } catch {}
  }

  // Fireworks particles on canvas
  const fw = {
    running: false,
    particles: [],
    start() {
      const canvas = els.fwCanvas;
      canvas.classList.remove("hidden");
      canvas.width = canvas.clientWidth * window.devicePixelRatio;
      canvas.height = canvas.clientHeight * window.devicePixelRatio;
      this.particles = [];
      for (let i = 0; i < 80; i++) {
        this.particles.push({
          x: canvas.width / 2,
          y: canvas.height - 10,
          vx: (Math.random() - 0.5) * 6,
          vy: -Math.random() * 8 - 4,
          life: 60 + Math.random() * 30,
          color: `hsl(${Math.random() * 360}, 90%, 60%)`
        });
      }
      this.running = true;
      this.loop();
      setTimeout(() => this.stop(), 1500);
    },
    stop() {
      this.running = false;
      els.fwCanvas.classList.add("hidden");
    },
    loop() {
      if (!this.running) return;
      const ctx = els.fwCanvas.getContext("2d");
      ctx.clearRect(0, 0, els.fwCanvas.width, els.fwCanvas.height);
      this.particles.forEach(p => {
        p.vy += 0.15;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
      });
      this.particles = this.particles.filter(p => p.life > 0 && p.y < els.fwCanvas.height);
      requestAnimationFrame(() => this.loop());
    }
  };

  // Wire toggles
  ["explosions", "blips", "chars", "shake", "sound", "fireworks", "reducedEffects"].forEach(key => {
    els[key].addEventListener("change", () => {
      vscode.postMessage({ type: "toggle", key, value: els[key].checked });
    });
  });

  els.resetBtn.addEventListener("click", () => vscode.postMessage({ type: "resetXp" }));
  els.testFireworks.addEventListener("click", () => {
    // Play sound if enabled (same as real fireworks)
    if (els.sound.checked) playBeep(0.5);
    fw.start();
  });

  function setState({ xp, level, xpNext, xpLevelStart = 0 }) {
    const current = xp - xpLevelStart;
    const max = xpNext - xpLevelStart;
    els.levelLabel.textContent = `Level: ${level}`;
    els.xpLabel.textContent = `XP: ${xp} / ${xpNext}`;
    const pct = Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100));
    els.barInner.style.width = `${pct}%`;
  }

  window.addEventListener("message", e => {
    const msg = e.data;
    switch (msg.type) {
      case "init":
        // Settings
        els.explosions.checked = msg.settings.explosions;
        els.blips.checked = msg.settings.blips;
        els.chars.checked = msg.settings.chars;
        els.shake.checked = msg.settings.shake;
        els.sound.checked = msg.settings.sound;
        els.fireworks.checked = msg.settings.fireworks;
        els.reducedEffects.checked = msg.settings.reducedEffects;
        setState(msg);
        break;
      case "state":
        setState(msg);
        break;
      case "blip":
        if (msg.enabled) playBeep(msg.pitch || 1.0);
        break;
      case "boom":
        if (msg.enabled) playExplosion();
        break;
      case "fireworks":
        if (msg.enabled) playBeep(0.5);
        fw.start();
        break;
    }
  });

  // Wait for DOM to be ready before sending ready message
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      vscode.postMessage({ type: "ready" });
    });
  } else {
    vscode.postMessage({ type: "ready" });
  }
})();