# Installation

DomChangeObserver is distributed as plain JavaScript.

It is intentionally small, dependency-light, and does not require a build step.

There are three practical install paths:

1. Recommended (m7-lib v1+ and v098): explicit `install.js` wiring.
2. Legacy/global convenience: `auto.js` shim (global `lib` path only).
3. Standalone/module usage: import `DomChangeObserver` directly.

---

## Prerequisites

### Browser

* A modern browser runtime with `MutationObserver`
* A DOM root to observe (typically `document.body`)

### Node + jsdom (tests)

* A DOM implementation (for example jsdom)
* `MutationObserver` from that DOM realm

### Plain Node (no DOM)

Not supported (by design).

DomChangeObserver is a DOM primitive: without a DOM and without `MutationObserver`, there is nothing meaningful to observe.

---

## Option A — Recommended for m7-lib: `install.js`

Use `install.js` when you have an m7-lib instance object available (v1+ module usage, or explicit v098 wiring).

`install(lib, opts?)` is the primary integration API.

### v1 style example (no global `lib` required)

```js
import lib, { init } from "/vendor/m7-js-lib/src/index.js";
import installDomChangeObserver from "/vendor/m7-js-lib-primitive-dom-changeobserver/src/install.js";

init();

const { instance } = installDomChangeObserver(lib, {
  host: window,
  root: document.body,
  start: false,
});

const obs = instance || lib.service.get("primitive.dom.changeobserver");
obs.addSelector(".active");
obs.start();
```

### What `install.js` registers

* Namespace path: `lib.primitive.dom.changeobserver`
* Constructor: `lib.primitive.dom.changeobserver.DomChangeObserver`
* Service (if `lib.service.set` exists): `primitive.dom.changeobserver`
* Namespace instance (when a service/instance exists): `lib.primitive.dom.changeobserver.instance`

### `install()` options

* `host`: host/realm used for default root and `MutationObserver` resolution
* `root`: explicit default root for created instance
* `instance`: provide your own observer instance
* `force`: replace existing service instance
* `configureDefaults`: apply conservative defaults (default: `true`)
* `start`: call `instance.start()` after install (default: `false`)

---

## Option B — Legacy/global convenience: `auto.js` shim

`auto.js` is a thin compatibility shim.

Behavior:

* If `globalThis.lib` exists, it delegates to `install(lib, { host })`.
* If no global `lib` exists, it warns and safely no-ops.

This makes `auto.js` compatible with mixed environments while avoiding hard failures in v1 module setups that do not expose a global `lib`.

### Browser load order (legacy/global path)

```html
<!-- Load m7-lib first (creates global `lib`) -->
<script src="/lib/m7-lib.min.js"></script>

<!-- Then load changeobserver shim -->
<script type="module" src="/lib/dom/changeobserver/auto.js"></script>
```

If you are already in a v1 module context with a local `lib` object, prefer Option A (`install.js`) instead of relying on global wiring.

---

## Option C — Standalone / module usage (no m7-lib)

Use this for bundlers, tests, Node + jsdom, or any environment not using m7-lib integration.

```js
import DomChangeObserver from "./src/DomChangeObserver.js";

const obs = new DomChangeObserver({
  root: document.body,
  onChange(batch) {
    console.log(batch);
  },
});

obs.addSelector(".active");
obs.start();
```

### Node + jsdom

```js
import { JSDOM } from "jsdom";
import DomChangeObserver from "./src/DomChangeObserver.js";

const { window } = new JSDOM("<body></body>");

const obs = new DomChangeObserver({
  host: window,
  root: window.document.body,
});

obs.addSelector("[data-foo]");
obs.start();
```

This avoids cross-realm issues by using same-realm `MutationObserver`.

---

## Troubleshooting

| Symptom                                                    | Likely cause                                             | Fix                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| `install(lib) requires an m7-lib instance object`         | invalid/non-object `lib` passed to `install()`           | pass the real m7-lib instance                                      |
| `install(lib) requires lib.hash.set`                      | incomplete m7-lib build                                  | include hash registry support                                      |
| `auto.js: global lib not found; skipping auto-install.`   | running `auto.js` without global `lib` (normal in v1)    | call `installDomChangeObserver(lib, ...)` explicitly               |
| `start(): no DOM root available`                          | resolved root is null                                    | pass `root` in install/options or call `setRoot(...)` before start |
| `start(): MutationObserver is not available`              | plain Node or wrong realm                                | use browser/jsdom and inject same-realm host                       |

---

## Related docs

* **Quick Start** → [QUICKSTART.md](./QUICKSTART.md)
* **Examples Library** → [EXAMPLES_LIBRARY.md](./EXAMPLES_LIBRARY.md)
* **Performance Notes** → [PERFORMANCE.md](./PERFORMANCE.md)
* **Integration Reference** → [../api/AUTO.md](../api/AUTO.md)
* **API Index** → [../api/INDEX.md](../api/INDEX.md)
* **Why not raw `MutationObserver`?** → [../WHY_NOT_MUTATION_OBSERVER.md](../WHY_NOT_MUTATION_OBSERVER.md)
