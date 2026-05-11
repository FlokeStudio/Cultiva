/**
 * Runs Cultiva plugin code in a sandboxed iframe (opaque origin, no allow-same-origin).
 * Plugin execution uses new Function only inside the iframe — not in the app renderer,
 * so the plugin cannot access window.electron or other privileged APIs.
 *
 * Parent ↔ iframe protocol: postMessage with __cultivaPlugin: true and targetPluginId.
 */

const RPC_METHODS = new Set(['storage.get', 'storage.set', 'ui.showNotification']);

function buildSandboxDocument(pluginId, manifest, pluginCode) {
  const mid = JSON.stringify(pluginId);
  const man = JSON.stringify(manifest);
  const code = JSON.stringify(pluginCode);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body>
<script>
(function () {
  'use strict';
  var PLUGIN_ID = ${mid};
  var manifest = ${man};
  var PLUGIN_CODE = ${code};

  var pendingRpc = new Map();
  var rpcId = 0;

  function send(payload) {
    if (window.parent) {
      window.parent.postMessage(Object.assign({ __cultivaPlugin: true, targetPluginId: PLUGIN_ID }, payload), '*');
    }
  }

  function rpc(method, args) {
    return new Promise(function (resolve, reject) {
      var id = ++rpcId;
      pendingRpc.set(id, { resolve: resolve, reject: reject });
      send({ type: 'RPC', id: id, method: method, args: args });
    });
  }

  var hookCallbacks = Object.create(null);
  var hooks = {
    on: function (name, callback) {
      if (!hookCallbacks[name]) hookCallbacks[name] = [];
      hookCallbacks[name].push(callback);
      send({ type: 'HOOK_REGISTER', hookName: name });
    }
  };

  var pluginInstance = null;
  var headerOnClick = null;
  var gardenRenderFn = null;
  var gardenRelay = null;

  var context = {
    manifest: manifest,
    storage: {
      get: function (key) { return rpc('storage.get', [key]); },
      set: function (key, value) { return rpc('storage.set', [key, value]); }
    },
    ui: {
      registerHeaderItem: function (config) {
        headerOnClick = config && config.onClick;
        send({
          type: 'UI_REGISTER_HEADER',
          label: config && config.label,
          icon: config && config.icon,
          hasOnClick: typeof (config && config.onClick) === 'function'
        });
      },
      registerGardenWidget: function (config) {
        gardenRenderFn = config && config.render;
        var position = (config && config.position) || 'top';
        gardenRelay = { id: '', className: '' };
        gardenRelay.appendChild = function () {
          console.warn('[PluginSandbox] appendChild is not supported; use innerHTML.');
        };
        Object.defineProperty(gardenRelay, 'innerHTML', {
          configurable: true,
          get: function () { return ''; },
          set: function (html) {
            send({ type: 'GARDEN_HTML', position: position, html: String(html) });
          }
        });
        send({ type: 'GARDEN_REGISTER', position: position });
      },
      showNotification: function (text, icon) {
        return rpc('ui.showNotification', [text, icon != null ? icon : '\\uD83D\\uDD0C']);
      }
    }
  };

  window.addEventListener('message', function (ev) {
    if (ev.source !== window.parent) return;
    var d = ev.data;
    if (!d || d.targetPluginId !== PLUGIN_ID) return;

    if (d.type === 'RPC_RESULT') {
      var p = pendingRpc.get(d.id);
      if (p) {
        pendingRpc.delete(d.id);
        if (d.error) p.reject(new Error(d.error));
        else p.resolve(d.result);
      }
      return;
    }
    if (d.type === 'INVOKE_HOOK') {
      var list = hookCallbacks[d.hookName] || [];
      var args = d.args || [];
      list.forEach(function (cb) {
        Promise.resolve(cb.apply(null, args)).catch(function (e) {
          console.error('[PluginSandbox] hook error', d.hookName, e);
        });
      });
      return;
    }
    if (d.type === 'INVOKE_INSTANCE') {
      if (pluginInstance && typeof pluginInstance[d.method] === 'function') {
        Promise.resolve(pluginInstance[d.method].apply(pluginInstance, d.args || [])).catch(function (e) {
          console.error('[PluginSandbox] instance method error', d.method, e);
        });
      }
      return;
    }
    if (d.type === 'HEADER_ONCLICK') {
      if (headerOnClick && typeof headerOnClick === 'function') {
        Promise.resolve(headerOnClick.call(pluginInstance)).catch(function (e) {
          console.error('[PluginSandbox] onClick error', e);
        });
      }
      return;
    }
    if (d.type === 'RUN_GARDEN_RENDER') {
      if (gardenRelay && gardenRenderFn && typeof gardenRenderFn === 'function') {
        try {
          gardenRenderFn(gardenRelay);
        } catch (e) {
          console.error('[PluginSandbox] garden render error', e);
        }
      }
      return;
    }
    if (d.type === 'LIFECYCLE') {
      if (pluginInstance && typeof pluginInstance[d.name] === 'function') {
        Promise.resolve(pluginInstance[d.name].apply(pluginInstance, d.args || [])).catch(function (e) {
          console.error('[PluginSandbox] lifecycle error', d.name, e);
        });
      }
      return;
    }
  });

  function run() {
    try {
      pluginInstance = new Function('context', 'hooks', PLUGIN_CODE)(context, hooks);
    } catch (e) {
      send({ type: 'SANDBOX_ERROR', error: String(e && e.message ? e.message : e) });
      return;
    }

    function sendReady() {
      send({
        type: 'SANDBOX_READY',
        methods: pluginInstance
          ? Object.keys(pluginInstance).filter(function (k) { return typeof pluginInstance[k] === 'function'; })
          : []
      });
    }

    if (pluginInstance && typeof pluginInstance.onEnable === 'function') {
      Promise.resolve(pluginInstance.onEnable())
        .then(sendReady)
        .catch(function (e) {
          send({ type: 'SANDBOX_ERROR', error: String(e && e.message ? e.message : e) });
        });
    } else {
      sendReady();
    }
  }

  run();
})();
</script>
</body></html>`;
}

function createInstanceProxy(host, methodNames) {
  const proxy = {};
  for (const name of methodNames) {
    proxy[name] = (...args) => host.invokeInstanceMethod(name, args);
  }
  return proxy;
}

export class PluginSandboxHost {
  constructor(pluginId, manifest) {
    this.pluginId = pluginId;
    this.manifest = manifest;
    this.iframe = null;
    this._blobUrl = null;
    this._onMessage = this._onMessage.bind(this);
    this._loadResolve = null;
    this._loadReject = null;
    this._loadTimeout = null;
    this._registeredHooks = new Set();
    this._handlers = {
      onRpc: null,
      onHookRegister: null,
      onUiRegisterHeader: null,
      onGardenRegister: null,
      onGardenHtml: null,
      onReady: null,
      onError: null
    };
  }

  setHandler(event, fn) {
    this._handlers[event] = fn;
  }

  _onMessage(ev) {
    if (!this.iframe || ev.source !== this.iframe.contentWindow) {
      return;
    }
    const d = ev.data;
    if (!d || d.__cultivaPlugin !== true || d.targetPluginId !== this.pluginId) {
      return;
    }

    if (d.type === 'RPC') {
      const { id, method, args } = d;
      if (!RPC_METHODS.has(method)) {
        this._replyRpc(id, undefined, 'Blocked RPC: ' + method);
        return;
      }
      const handler = this._handlers.onRpc;
      if (!handler) {
        this._replyRpc(id, undefined, 'No RPC handler');
        return;
      }
      Promise.resolve(handler(method, args || []))
        .then((result) => this._replyRpc(id, result))
        .catch((err) => this._replyRpc(id, undefined, String(err && err.message ? err.message : err)));
      return;
    }

    if (d.type === 'HOOK_REGISTER') {
      this._registeredHooks.add(d.hookName);
      if (this._handlers.onHookRegister) {
        this._handlers.onHookRegister(d.hookName);
      }
      return;
    }

    if (d.type === 'UI_REGISTER_HEADER') {
      if (this._handlers.onUiRegisterHeader) {
        this._handlers.onUiRegisterHeader(d);
      }
      return;
    }

    if (d.type === 'GARDEN_REGISTER') {
      if (this._handlers.onGardenRegister) {
        this._handlers.onGardenRegister(d);
      }
      return;
    }

    if (d.type === 'GARDEN_HTML') {
      if (this._handlers.onGardenHtml) {
        this._handlers.onGardenHtml(d);
      }
      return;
    }

    if (d.type === 'SANDBOX_READY') {
      const methods = d.methods || [];
      if (this._loadTimeout) {
        clearTimeout(this._loadTimeout);
        this._loadTimeout = null;
      }
      if (this._loadResolve) {
        this._loadResolve({
          methods,
          instanceProxy: createInstanceProxy(this, methods)
        });
        this._loadResolve = null;
        this._loadReject = null;
      }
      if (this._handlers.onReady) {
        this._handlers.onReady(methods);
      }
      return;
    }

    if (d.type === 'SANDBOX_ERROR') {
      if (this._loadTimeout) {
        clearTimeout(this._loadTimeout);
        this._loadTimeout = null;
      }
      if (this._loadReject) {
        this._loadReject(new Error(d.error || 'Sandbox error'));
        this._loadResolve = null;
        this._loadReject = null;
      }
      if (this._handlers.onError) {
        this._handlers.onError(d.error);
      }
      return;
    }
  }

  _replyRpc(id, result, error) {
    this.postToSandbox({ type: 'RPC_RESULT', id, result, error });
  }

  postToSandbox(payload) {
    if (!this.iframe || !this.iframe.contentWindow) {
      return;
    }
    this.iframe.contentWindow.postMessage(Object.assign({ targetPluginId: this.pluginId }, payload), '*');
  }

  invokeInstanceMethod(method, args = []) {
    this.postToSandbox({ type: 'INVOKE_INSTANCE', method, args });
  }

  invokeHeaderOnClick() {
    this.postToSandbox({ type: 'HEADER_ONCLICK' });
  }

  invokeHook(hookName, args) {
    this.postToSandbox({ type: 'INVOKE_HOOK', hookName, args });
  }

  runGardenRender() {
    this.postToSandbox({ type: 'RUN_GARDEN_RENDER' });
  }

  async runLifecycle(name, args = []) {
    this.postToSandbox({ type: 'LIFECYCLE', name, args });
  }

  hasHook(hookName) {
    return this._registeredHooks.has(hookName);
  }

  /**
   * @param {string} pluginCode
   * @returns {Promise<{ methods: string[], instanceProxy: object }>}
   */
  load(pluginCode) {
    return new Promise((resolve, reject) => {
      this._loadResolve = resolve;
      this._loadReject = reject;
      window.addEventListener('message', this._onMessage);

      const html = buildSandboxDocument(this.pluginId, this.manifest, pluginCode);
      const blob = new Blob([html], { type: 'text/html' });
      this._blobUrl = URL.createObjectURL(blob);

      this.iframe = document.createElement('iframe');
      this.iframe.setAttribute('sandbox', 'allow-scripts');
      this.iframe.setAttribute('title', 'plugin-sandbox-' + this.pluginId);
      this.iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden;pointer-events:none';
      document.body.appendChild(this.iframe);
      this.iframe.src = this._blobUrl;

      this._loadTimeout = setTimeout(() => {
        this._loadTimeout = null;
        if (this._loadReject) {
          this._loadReject(new Error('Plugin sandbox load timeout'));
          this._loadResolve = null;
          this._loadReject = null;
        }
        this.destroy();
      }, 30000);
    });
  }

  destroy() {
    if (this._loadTimeout) {
      clearTimeout(this._loadTimeout);
      this._loadTimeout = null;
    }
    window.removeEventListener('message', this._onMessage);
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
    if (this._blobUrl) {
      URL.revokeObjectURL(this._blobUrl);
      this._blobUrl = null;
    }
    this._loadResolve = null;
    this._loadReject = null;
    this._registeredHooks.clear();
  }
}
