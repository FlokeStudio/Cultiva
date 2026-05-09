<div align="center">

<img width="256" alt="Cultiva" height="256" alt="app-icon" src="https://github.com/user-attachments/assets/030f5bf0-aae4-4b3b-ad9e-f3610c371643" />


# Cultiva

**A gamified habit tracker where consistency isn't tracked — it's grown.**

[![Release](https://img.shields.io/github/v/release/krwg/Cultiva?style=flat-square&color=4caf50&label=latest)](https://github.com/krwg/Cultiva/releases/latest)
[![License](https://img.shields.io/github/license/krwg/Cultiva?style=flat-square&color=af52de)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0071e3?style=flat-square&logo=windows&logoColor=white)](https://github.com/krwg/Cultiva/releases/latest)
[![Stars](https://img.shields.io/github/stars/krwg/Cultiva?style=flat-square&color=ffca28)](https://github.com/krwg/Cultiva/stargazers)
[![Discord](https://img.shields.io/badge/discord-rich%20presence-5865F2?style=flat-square&logo=discord&logoColor=white)](#)

</div>

---

Cultiva is an **offline-first desktop habit tracker** built around a simple idea: habits don't get checked off — they grow. Each habit you plant evolves from a seed into something lasting, reflecting the time and consistency you put into it.

No subscriptions. No cloud. No noise. Just you and your garden.

<br>

## Download

**[→ Latest release](https://github.com/krwg/Cultiva/releases/latest)**

| Format | Best for |
|--------|----------|
| Installer `.exe` | Daily use — installs to Program Files, creates shortcuts, auto-updates |
| Portable `.exe` | No install needed — run directly from anywhere or a USB drive |

> First launch may take a few seconds while local storage initializes.

<br>

## How it works

Plant a habit. Show up daily. Watch it grow.

```
Seed  →  Sprout  →  Plant  →  Tree  →  Legacy (365+ days)
```

Each stage is a visual milestone — not just a number. Hit 365 days and your habit becomes a Legacy Tree: a permanent achievement that stays in your garden.

<br>

## Features

| | |
|---|---|
| **Visual growth system** | Habits evolve through real visual stages, not just streaks |
| **Legacy Trees** | 365+ days unlocks a permanent trophy in your garden |
| **Focus Mode** | Distraction-free UI for deep work |
| **12 themes** | Light, Dark, Evergreen, Blossom, Ocean, Sunset, Frost, Cedar, Dusk, Meadow, and more |
| **Animated backgrounds** | Aurora, Rainfall, Starlight, Snowfall, Fireflies |
| **GitHub-style calendar** | Your consistency at a glance, with holiday markers |
| **Plugin system** | Extend Cultiva with community-built plugins |
| **Discord Rich Presence** | Share your garden activity with friends |
| **Auto-updates** | New versions download in the background — one click to install |
| **Offline-first** | No servers, no tracking, no internet required |
| **i18n** | English and Russian, with easy extension |

<br>

## Plugins

Cultiva has a built-in plugin system — browse, install, and manage from **Settings → Plugins**.

| Plugin | Description |
|--------|-------------|
| Weather Widget | Current temperature, feels like, humidity, wind. Any city worldwide via Open-Meteo (free, no API key) |
| Clock Widget | Live clock with customizable format and rainbow color mode |
| Radio Widget | Ambient stations — Lofi, Jazz, Classical, Nature |

Want to build your own? Start with the [Plugin Development Guide](https://github.com/krwg/CultivaPlugins/blob/main/PLUGIN-DEV-GUIDE.md) and the [boilerplate](https://github.com/krwg/CultivaPlugins/tree/main/boilerplate). Plugins are installed per-user and stored in `%APPDATA%/cultiva/cultiva-plugins/`.

→ [Plugin registry](https://github.com/krwg/CultivaPlugins)

<br>

## Tech stack

| Layer | Technology |
|-------|------------|
| Runtime | Electron 30 + Node.js |
| Frontend | Vanilla JS (ES Modules), CSS Variables |
| Build | Vite 5 (multi-page app) |
| Storage | IndexedDB + localStorage fallback |
| Updates | electron-updater + GitHub Releases |
| Packaging | electron-builder (NSIS, Portable) |
| CI/CD | GitHub Actions |

<br>

## Development

```bash
git clone https://github.com/krwg/Cultiva.git
cd Cultiva
npm install

# Web dev server
npm run dev

# Electron with hot reload (recommended)
npm run electron:dev:watch

# Production build
npm run build          # → /dist
npm run electron:build # → /release
```

<br>

## Contributing

All contributions are welcome — no task is too small.

- **Bug report** → [open an issue](https://github.com/krwg/Cultiva/issues/new?template=bug_report.yml) with steps to reproduce, expected vs actual behavior, and console logs
- **Feature idea** → [feature request](https://github.com/krwg/Cultiva/issues/new?template=feature_request.yml)
- **Code** → fork, branch off `main`, open a PR with a clear description
- **Plugin** → [Plugin Dev Guide](https://github.com/krwg/CultivaPlugins/blob/main/PLUGIN-DEV-GUIDE.md)
- **Discuss** → [Discussions](https://github.com/krwg/Cultiva/discussions)

<br>

---

<div align="center">

Built with patience by [krwg](https://github.com/krwg) · MIT License · «Sequoia» · [0.3.5]

</div>
