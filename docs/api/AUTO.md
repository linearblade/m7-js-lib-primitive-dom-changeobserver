# Integration Reference (`install.js` + `auto.js`)

DomChangeObserver exposes two m7 integration entry points:

* `install.js` (recommended): explicit installer API for m7-lib instances
* `auto.js` (compatibility shim): global-lib bridge for legacy/browser-global setups

If you are using the primitive standalone, you do not need either file; import `DomChangeObserver` directly.

---

## Recommended: `install.js`

`install(lib, opts?)` is the canonical integration API.

```js
import lib, { init } from "/vendor/m7-js-lib/src/index.js";
import installDomChangeObserver from "/vendor/m7-js-lib-primitive-dom-changeobserver/src/install.js";

init();

const result = installDomChangeObserver(lib, {
  host: window,
  root: document.body,
  start: false,
});

const obs = result.instance || lib.service.get("primitive.dom.changeobserver");
```

### What it registers

* Namespace: `lib.primitive.dom.changeobserver`
* Constructor: `lib.primitive.dom.changeobserver.DomChangeObserver`
* Service (when available): `lib.service.set("primitive.dom.changeobserver", instance)`
* Namespace instance (when available): `lib.primitive.dom.changeobserver.instance`

### Installer options

* `host`
* `root`
* `instance`
* `force`
* `configureDefaults` (default `true`)
* `start` (default `false`)

---

## `auto.js` shim behavior

`auto.js` now delegates to `install.js`.

Behavior:

* If `globalThis.lib` is present, it calls `install(lib, { host })`.
* If global `lib` is missing, it warns and no-ops.

This is intentional for compatibility with v1 module usage where `lib` is local/imported, not global.

```html
<!-- Legacy/global path only -->
<script src="/lib/m7-lib.min.js"></script>
<script type="module" src="/lib/dom/changeobserver/auto.js"></script>
```

In v1 module environments, prefer explicit installer usage and skip `auto.js`.

---

## Start behavior

Neither `install.js` nor `auto.js` starts observation by default.

You can either:

* call `obs.start()` yourself, or
* pass `start: true` to `install()`

```js
installDomChangeObserver(lib, {
  host: window,
  root: document.body,
  start: true,
});
```

---

## Troubleshooting

| Symptom                                                  | Likely cause                                           | Fix                                                |
| -------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| `install(lib) requires an m7-lib instance object`       | invalid `lib` argument                                 | pass actual m7-lib instance                        |
| `install(lib) requires lib.hash.set`                    | incomplete m7-lib build                                | include hash registry support                      |
| `auto.js: global lib not found; skipping auto-install.` | running shim in non-global/v1 module setup             | call `installDomChangeObserver(lib, ...)` directly |
| `start(): no DOM root available`                        | no valid root available                                | pass `root` or call `setRoot(...)`                |

---

## Notes

* `auto.js` is compatibility wiring, not the primary integration API.
* `install.js` is explicitly for m7-lib wiring and is not required for standalone usage.
* Integration wiring does not change DomChangeObserver runtime semantics.

---

## Related docs

* **Installation** → [../usage/INSTALLATION.md](../usage/INSTALLATION.md)
* **Quick Start** → [../usage/QUICKSTART.md](../usage/QUICKSTART.md)
* **Event Handlers** → [EVENT_HANDLERS.md](./EVENT_HANDLERS.md)
* **API Index** → [INDEX.md](./INDEX.md)
