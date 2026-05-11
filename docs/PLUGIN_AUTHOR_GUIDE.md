# Cultiva plugins guide

This document is for developers who publish plugins in **[CultivaPlugins](https://github.com/krwg/CultivaPlugins)**. The Cultiva app **downloads** manifests and files from GitHub (HTTPS) and installs them under the user profile (`userData/cultiva-plugins`). The `plugins/` folder in the **Cultiva** or **CultivaPlugins** repo is only for **development and publishing**; the running app does **not** read plugin code from your local project tree.

---

## 1. Repository layout (store)

Each plugin is a folder at the root of the CultivaPlugins repo, for example:

```
weather/
  manifest.json
  index.js
  styles.css        # optional, listed in manifest.styles
```

The **registry** (`registry.json` at repo root) lists each plugin with `id`, `baseUrl` (raw GitHub URL to that folder), `version`, `minAppVersion`, etc. The app fetches `registry.json`, then installs by downloading `manifest.json`, the entry script, and any `manifest.styles` files from `baseUrl`.

---

## 2. `manifest.json`

| Field | Required | Description |
|--------|----------|-------------|
| `id` | yes | Lowercase id, letters/digits/`_`/`-` only (must match install folder name). |
| `name`, `version`, `description`, `icon` | yes | Shown in Settings → Plugins. |
| `entry` | yes | Filename of the main script (e.g. `index.js`). |
| `styles` | no | Array of CSS paths relative to the plugin folder; the **app** injects them into the main window (you do not call `window.electron` from plugin code). |
| `minAppVersion` | recommended | Minimum Cultiva version, e.g. `0.4.0`. |

Example:

```json
{
  "id": "weather",
  "name": "Weather Widget",
  "version": "1.6.1",
  "entry": "index.js",
  "styles": ["styles.css"],
  "minAppVersion": "0.4.0",
  "icon": "🌤️",
  "description": "Shows weather in the header."
}
```

---

## 3. Entry script (sandbox)

Plugin code runs inside a **sandboxed iframe** (no `window.electron`, no access to the main DOM). The host loads your file as the **body** of a function:

```js
(function (context, hooks) {
  // YOUR FILE CONTENT HERE — must end by returning the plugin instance
})(context, hooks);
```

So your `index.js` should look like a **class + return**:

```javascript
class MyPlugin {
  constructor(context, hooks) {
    this.context = context;
    this.hooks = hooks;
  }

  async onEnable() {
    const saved = await this.context.storage.get('settings');
    this.context.ui.registerHeaderItem({
      label: 'Hello',
      icon: '👋',
      onClick: () => this.sayHi()
    });
  }

  sayHi() {
    this.context.ui.showNotification('👋', 'Hello from my plugin');
  }

  onDisable() {
    // cleanup timers, etc.
  }
}

return new MyPlugin(context, hooks);
```

### `context`

- **`context.manifest`** — parsed `manifest.json`.
- **`context.storage.get(key)` / `context.storage.set(key, value)`** — async key/value scoped per plugin (persisted by the app).
- **`context.ui.registerHeaderItem({ label, icon, onClick? })`** — header chip; `onClick` runs in the sandbox when the user clicks.
- **`context.ui.registerGardenWidget({ position, render })`** — `render` receives a relay object: set **`relay.innerHTML = '...'`** to push HTML into the main garden (sanitized path; no `appendChild` on real DOM).
- **`context.ui.showNotification(icon, text)`** — toast in the main app (`icon` first, then `text`).

### `hooks`

- **`hooks.on('onAppStart', fn)`**, **`hooks.on('onHabitComplete', fn)`**, etc. — subscribe to documented hooks; the sandbox notifies the host.

### Not allowed in the sandbox

- `window.electron`, `require`, `fetch` to `file:` URLs, or direct DOM access to the main window. Use `context` / `hooks` only. **CSS** goes through `manifest.styles` (injected by Cultiva).

---

## 4. Optional modal methods

If you register a header item and expose methods on the instance (e.g. `openSettingsModal`), the host may wire the chip to that method when the name matches known patterns. Prefer **`onClick`** in `registerHeaderItem` for new plugins.

---

## 5. Versioning and store updates

1. Bump `version` in `manifest.json`.
2. Bump the same version in `registry.json` for that plugin’s entry.
3. Commit and push to `main` on CultivaPlugins.

Users install or update from **Settings → Plugins**; the app re-downloads files from `baseUrl` on install.

---

## 6. Quick checklist before PR

- [ ] Valid JSON in `manifest.json`; `entry` file exists.
- [ ] `return new YourPlugin(context, hooks);` at end of `index.js`.
- [ ] No `window.electron` or main-window DOM assumptions.
- [ ] Styles listed in `manifest.styles` if you ship CSS.
- [ ] `minAppVersion` set to the lowest Cultiva build you tested.
- [ ] `registry.json` updated with correct `baseUrl` and version.

For questions, open an issue on [CultivaPlugins](https://github.com/krwg/CultivaPlugins).
