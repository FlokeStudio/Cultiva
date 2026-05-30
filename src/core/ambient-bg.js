import { AMBIENT_BG_LAYER_IDS, LS_CUSTOM_BG_DATA, getWithBgClassList } from './theme-config.js';

const MAX_CUSTOM_BYTES = 1_400_000;

function stripAmbientClasses(body) {
  body.classList.remove('with-ambient-bg', ...getWithBgClassList());
}

function hideAllLayers(doc) {
  [...AMBIENT_BG_LAYER_IDS, 'custom'].forEach((id) => {
    const el = doc.getElementById(`bg-${id}`);
    if (el) {
      el.style.display = 'none';
      if (id === 'custom') {
        el.style.backgroundImage = 'none';
      }
    }
  });
}

export function readCustomBackgroundDataUrl() {
  try {
    return localStorage.getItem(LS_CUSTOM_BG_DATA) || '';
  } catch {
    return '';
  }
}

/**
 * @param {Document} doc
 * @param {HTMLElement} body
 * @param {string} bg value from cultiva-background (none | layer id | custom)
 */
export function applyAmbientBackground(doc, body, bg) {
  stripAmbientClasses(body);
  hideAllLayers(doc);

  if (!bg || bg === 'none') {
    return;
  }

  if (bg === 'custom') {
    const url = readCustomBackgroundDataUrl();
    if (!url) {
      return;
    }
    const el = doc.getElementById('bg-custom');
    if (!el) { return; }
    el.style.backgroundImage = `url(${JSON.stringify(url)})`;
    el.style.display = 'block';
    body.classList.add('with-bg-custom', 'with-ambient-bg');
    return;
  }

  const container = doc.getElementById(`bg-${bg}`);
  if (!container) { return; }

  container.style.display = 'block';
  body.classList.add(`with-bg-${bg}`, 'with-ambient-bg');

  if (bg === 'rainfall') { generateRaindrops(container); }
  if (bg === 'starlight') { generateStars(container); }
  if (bg === 'snowfall') { generateSnowflakes(container); }
  if (bg === 'fireflies') { generateFireflies(container); }
  if (bg === 'petal') { generatePetals(container); }
  if (bg === 'ember') { generateEmbers(container); }
  if (bg === 'breeze') { generateBreeze(container); }
  if (bg === 'cypress-drift') { generateCypressNeedles(container); }
  if (bg === 'dew') { generateDew(container); }
  if (bg === 'sunbeam') { generateSunbeams(container); }
}

export function saveCustomBackgroundFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Not an image'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result.length > MAX_CUSTOM_BYTES) {
        reject(new Error('Image too large'));
        return;
      }
      try {
        localStorage.setItem(LS_CUSTOM_BG_DATA, result);
        resolve(result);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('Read failed'));
    reader.readAsDataURL(file);
  });
}

export function clearCustomBackground() {
  try {
    localStorage.removeItem(LS_CUSTOM_BG_DATA);
  } catch { /* ignore */ }
}

function generateRaindrops(container) {
  container.innerHTML = '';
  for (let i = 0; i < 50; i++) {
    const drop = document.createElement('div');
    drop.className = 'rain-drop';
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.animationDelay = `${Math.random() * 2}s`;
    drop.style.animationDuration = `${1 + Math.random() * 1}s`;
    container.appendChild(drop);
  }
}

function generateStars(container) {
  container.innerHTML = '';
  for (let i = 0; i < 100; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.animationDelay = `${Math.random() * 3}s`;
    star.style.animationDuration = `${2 + Math.random() * 4}s`;
    container.appendChild(star);
  }
}

function generateSnowflakes(container) {
  container.innerHTML = '';
  const snowflakes = ['❄️', '❅', '❆', '✻', '✼', '❉'];
  for (let i = 0; i < 40; i++) {
    const flake = document.createElement('div');
    flake.className = 'snowflake';
    flake.textContent = snowflakes[Math.floor(Math.random() * snowflakes.length)];
    flake.style.left = `${Math.random() * 100}%`;
    flake.style.fontSize = `${0.8 + Math.random() * 1.5}em`;
    flake.style.animationDelay = `${Math.random() * 5}s`;
    flake.style.animationDuration = `${5 + Math.random() * 7}s`;
    container.appendChild(flake);
  }
}

function generateFireflies(container) {
  container.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const fly = document.createElement('div');
    fly.className = 'firefly';
    fly.style.left = `${Math.random() * 100}%`;
    fly.style.top = `${20 + Math.random() * 60}%`;
    fly.style.animationDelay = `${Math.random() * 8}s`;
    fly.style.animationDuration = `${6 + Math.random() * 10}s`;
    container.appendChild(fly);
  }
}

function generatePetals(container) {
  container.innerHTML = '';
  for (let i = 0; i < 36; i++) {
    const p = document.createElement('div');
    p.className = 'petal';
    p.style.left = `${Math.random() * 100}%`;
    p.style.animationDelay = `${Math.random() * 12}s`;
    p.style.animationDuration = `${14 + Math.random() * 12}s`;
    p.style.setProperty('--drift', `${(Math.random() - 0.5) * 80}px`);
    container.appendChild(p);
  }
}

function generateEmbers(container) {
  container.innerHTML = '';
  for (let i = 0; i < 40; i++) {
    const em = document.createElement('div');
    em.className = 'ember';
    em.style.left = `${Math.random() * 100}%`;
    em.style.animationDelay = `${Math.random() * 6}s`;
    em.style.animationDuration = `${4 + Math.random() * 8}s`;
    container.appendChild(em);
  }
}

function generateBreeze(container) {
  container.innerHTML = '';
  for (let i = 0; i < 28; i++) {
    const b = document.createElement('div');
    b.className = 'breeze-line';
    b.style.left = `${Math.random() * 100}%`;
    b.style.top = `${Math.random() * 100}%`;
    b.style.animationDelay = `${Math.random() * 8}s`;
    b.style.animationDuration = `${10 + Math.random() * 14}s`;
    b.style.transform = `rotate(${-15 + Math.random() * 30}deg)`;
    container.appendChild(b);
  }
}

function generateCypressNeedles(container) {
  container.innerHTML = '';
  for (let i = 0; i < 48; i++) {
    const n = document.createElement('div');
    n.className = 'cypress-needle';
    n.style.left = `${Math.random() * 100}%`;
    n.style.animationDelay = `${Math.random() * 14}s`;
    n.style.animationDuration = `${12 + Math.random() * 16}s`;
    n.style.setProperty('--sway', `${(Math.random() - 0.5) * 60}px`);
    container.appendChild(n);
  }
}

function generateDew(container) {
  container.innerHTML = '';
  for (let i = 0; i < 55; i++) {
    const d = document.createElement('div');
    d.className = 'dew-drop';
    d.style.left = `${Math.random() * 100}%`;
    d.style.top = `${Math.random() * 100}%`;
    d.style.animationDelay = `${Math.random() * 6}s`;
    d.style.animationDuration = `${3 + Math.random() * 5}s`;
    container.appendChild(d);
  }
}

function generateSunbeams(container) {
  container.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const beam = document.createElement('div');
    beam.className = 'sunbeam-ray';
    beam.style.left = `${10 + i * 14}%`;
    beam.style.animationDelay = `${i * 1.2}s`;
    container.appendChild(beam);
  }
}
