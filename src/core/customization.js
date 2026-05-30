/** Apply user accent override on :root */
export function applyAccentColor(hex) {
  const root = document.documentElement;
  if (!hex || typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    root.style.removeProperty('--accent-custom');
    root.style.removeProperty('--accent-blue');
    root.style.removeProperty('--accent-blue-hover');
    return;
  }
  root.style.setProperty('--accent-custom', hex);
  root.style.setProperty('--accent-blue', hex);
  root.style.setProperty('--accent-blue-hover', hex);
}

/** 0–100 → opacity multiplier for ambient layers */
export function applyAmbientIntensity(percent) {
  const n = Number(percent);
  const clamped = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 100;
  document.documentElement.style.setProperty('--ambient-intensity', String(clamped / 100));
}
