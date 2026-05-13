<div align="center">
<img width="256" height="256" alt="app-icon" src="https://github.com/user-attachments/assets/8d37d600-c775-4dab-a351-8c39fde17fa7" />

# Cultiva

**A gamified habit tracker where consistency isn’t tracked — it’s grown.**

[![Release](https://img.shields.io/github/v/release/krwg/Cultiva?style=flat-square&color=34c759&label=latest)](https://github.com/krwg/Cultiva/releases/latest)
[![License](https://img.shields.io/github/license/krwg/Cultiva?style=flat-square&color=af52de)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0071e3?style=flat-square&logo=windows&logoColor=white)](https://github.com/krwg/Cultiva/releases/latest)
[![Stars](https://img.shields.io/github/stars/krwg/Cultiva?style=flat-square&color=ffcc00)](https://github.com/krwg/Cultiva/stargazers)
[![Discord](https://img.shields.io/badge/discord-rich%20presence-5865F2?style=flat-square&logo=discord&logoColor=white)](#discord-rich-presence)

</div>

---

Cultiva is an **offline-first desktop habit tracker** built around a simple idea: habits don’t get checked off — they **grow**. Each habit you plant evolves from a seed into something lasting, reflecting the time and consistency you put into it.

**No subscriptions. No cloud. No noise.** Just you and your garden.

---

## Download

**[→ Latest release](https://github.com/krwg/Cultiva/releases/latest)** · **[Release notes (0.4.1)](docs/RELEASE_0.4.1.md)** · [0.4.0](docs/RELEASE_0.4.0.md)

| Format | Best for |
|--------|----------|
| **Installer** (`.exe`) | Daily use — shortcuts, uninstall entry, in-app updates when published on GitHub Releases |
| **Portable** (`.exe`) | USB or “no install” workflows |

> First launch may take a moment while local storage (IndexedDB) initializes.

---

## How it works

Plant a habit. Show up. Watch it grow.

```
Seed → Sprout → Plant → Tree → Legacy (365+ days)
```

Each stage is a **visual milestone**, not just a counter. After **365 days**, the habit becomes a **Legacy** tree — a permanent trophy in your garden.

---

## Features

| | |
|---|---|
| **Visual growth** | Habits progress through tangible stages, not only streak numbers |
| **Legacy trees** | 365+ days unlock a lasting trophy in the garden |
| **Focus mode** | Minimal UI when you need fewer distractions |
| **Themes** | System **Auto**, built-in **Light / Dark**, and curated palettes grouped by light vs dark appearance (including Orchard, Honeycrisp, Inkwell, Sequoia) |
| **Ambient backgrounds** | Aurora, Rainfall, Starlight, Snowfall, Fireflies, Petal Drift, Silicon Mist, Ember Glow, Breeze Glass — plus an optional **custom photo** stored locally |
| **Shared look** | Theme and background apply to **both** the garden (home) and the **calendar** page |
| **GitHub-style calendar** | Month / week / day views, optional regional holidays |
| **Plugins** | Sandboxed extensions from the community registry ([CultivaPlugins](https://github.com/krwg/CultivaPlugins)) |
| **Discord Rich Presence** | Optional status line while you tend your garden |
| **Auto-updates** | `electron-updater` against GitHub Releases (when `latest.yml` is published with your build) |
| **Offline-first** | No account required for local use; no telemetry |
| **i18n** | English and Russian in the UI, structured for more locales |

---

## Plugins

Browse, install, and manage plugins under **Settings → Plugins**.

| Plugin | Description |
|--------|-------------|
| **Weather** | Temperature, “feels like”, humidity, wind — powered by Open-Meteo (no API key) |
| **Clock** | Live clock with format options |
| **Radio** | Ambient streams (e.g. lofi, jazz) |

**Authors:** see [`docs/PLUGIN_AUTHOR_GUIDE.md`](docs/PLUGIN_AUTHOR_GUIDE.md) in this repo for the manifest, sandbox API, and a release checklist. The public registry and boilerplate live in [**CultivaPlugins**](https://github.com/krwg/CultivaPlugins).

**Wiki (GitHub):** Markdown source for the project wiki lives in **`wiki/`** (gitignored by default). See [`docs/WIKI.md`](docs/WIKI.md) for how to publish those pages to GitHub Wiki.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Runtime | Electron 30 |
| UI | Vanilla JavaScript (ES modules), CSS variables |
| Build | Vite 5 (multi-page: home + calendar) |
| Data | IndexedDB with localStorage bridge where needed |
| Updates | `electron-updater` + GitHub Releases |
| Packaging | `electron-builder` (NSIS + portable on Windows) |

---

## Development

```bash
git clone https://github.com/krwg/Cultiva.git
cd Cultiva
npm install

# Web dev server (Vite)
npm run dev

# Electron with dev server (recommended)
npm run electron:dev:watch

# Production web build → dist/
npm run build

# Packaged Windows app → release/
npm run electron:build
```

---

## Contributing

**GitHub language:** issues, pull requests, commit messages, and **English** Markdown in this repository should be written in **English** so everyone can review and search them. In-app strings stay multilingual via `src/core/i18n.js`.

- **Bug** → [open an issue](https://github.com/krwg/Cultiva/issues/new) with repro steps and logs if possible.  
- **Idea** → issue or [Discussions](https://github.com/krwg/Cultiva/discussions).  
- **Code** → fork, branch from `main`, open a PR with a clear summary.  
- **Plugins** → contribute to [CultivaPlugins](https://github.com/krwg/CultivaPlugins) (registry + guides).

---

## Discord Rich Presence

When Discord is running on the same machine, Cultiva can show a simple presence line (garden state, etc.). Toggle it under **Settings → Discord**.

---

<div align="center">

Built with care by [krwg](https://github.com/krwg) · MIT License · «Coconut» · 0.4.1

</div>
