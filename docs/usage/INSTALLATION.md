# Installation

DomChangeObserver is distributed as **plain JavaScript**.

It is intentionally small, dependency-light, and does not require a build step.

There are **two supported installation modes**:

1. **Recommended (M7 users):** `auto.js` integration with **m7-lib** (browser wiring + service registration)
2. **Manual / Module usage:** import `DomChangeObserver` directly (bundlers, tests, Node + jsdom)

---

## Prerequisites

### Browser

* A modern browser runtime with `MutationObserver`
* A DOM root to observe (typically `document.body`)

### Node + jsdom (tests)

* A DOM implementation (e.g. jsdom)
* `MutationObserver` provided by that DOM realm

### Plain Node (no DOM)

Not supported (by design).

DomChangeObserver is a DOM primitive — without a DOM and without `MutationObserver`, there is nothing meaningful to observe.

---

## Option A — Recommended (M7 users): `auto.js`

If you are already using **m7-lib** in the browser, `auto.js` is the simplest path.

`auto.js` does two things:

1. **Registers** the module into the `lib` hierarchy:

   * `lib.hash.set(lib, "primitive.dom.changeobserver", { DomChangeObserver, instance })`

2. **Registers** a default singleton service instance:

   * `lib.service.set("primitive.dom.changeobserver", changeObserver)`

This makes the primitive available under the expected M7 namespace and provides a shared instance for subsystems.

### Project structure (example)

```
your-project/
├── lib/
│   ├── m7-lib.min.js
│   └── dom/
│       └── changeobserver/
│           ├── DomChangeObserver.js
│           └── auto.js
├── index.html
└── main.js
```

> You do **not** need to load any internal files beyond `DomChangeObserver.js` + `auto.js`.

### HTML setup

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>My App</title>
</head>
<body>

  <!-- Load m7-lib first (creates global `lib`) -->
  <script src="/lib/m7-lib.min.js"></script>

  <!-- Install primitive + register service -->
  <script type="module" src="/lib/dom/changeobserver/auto.js"></script>

  <!-- Your application -->
  <script src="/main.js"></script>
</body>
</html>
```

### What `auto.js` installs

After `auto.js` runs, you get:

* Namespace: `lib.primitive.dom.changeobserver.DomChangeObserver`
* Default instance:

  * `lib.primitive.dom.changeobserver.instance`
  * `lib.service.get("primitive.dom.changeobserver")` (if your service registry supports `get`)

### Default root behavior under m7-lib

`auto.js` attempts to select a reasonable default root from `lib._env`:

* `lib._env.root.document.body`, then
* `lib._env.root.document`, then
* `null`

If the resolved root is `null`, you must explicitly call `setRoot(...)` before `start()`.

### Default configuration under `auto.js`

The default instance is configured conservatively:

* `debounceMs: 0`
* `includeSubtreeMatches: false`
* `observeAttributes: false`
* `attributeFilter: null`
* `onChange: null`

This is intentional: the primitive is installed, but **it does not emit events unless a subsystem attaches handlers**.

---

## Option B — Manual / Module usage (no `auto.js`)

Use this approach for bundlers, tests, Node + jsdom, or environments without m7-lib.

### Copy / vendor files

You only need the class file:

```
src/
└── DomChangeObserver.js
```

### Import directly

```js
import DomChangeObserver from "./src/DomChangeObserver.js";

const obs = new DomChangeObserver({
  root: document.body,
  onChange(batch) {
    console.log(batch);
  }
});

obs.addSelector(".active");
obs.start();
```

### Node + jsdom usage

In jsdom-style environments, inject the realm host and root explicitly:

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

This prevents cross-realm issues by ensuring the observer uses the same-realm `MutationObserver` constructor.

---

## Troubleshooting

| Symptom                                      | Likely cause                                         | Fix                                          |
| -------------------------------------------- | ---------------------------------------------------- | -------------------------------------------- |
| `lib` is undefined                           | `m7-lib` not loaded or loaded after `auto.js`        | Load `m7-lib` first                          |
| `requires lib.hash.set`                      | service/hash registry missing from your m7-lib build | include the registry modules                 |
| `requires lib.service`                       | service registry missing                             | include service registry / `lib.service.set` |
| `start(): no DOM root available`             | root resolved to null                                | pass `opts.root` or call `setRoot(...)`      |
| `start(): MutationObserver is not available` | plain Node or wrong realm                            | use browser / jsdom host injection           |

---

## Related docs

* **Quick Start** → [QUICKSTART.md](./QUICKSTART.md)
* **Examples Library** → [EXAMPLES_LIBRARY.md](./EXAMPLES_LIBRARY.md)
* **Performance Notes** → [PERFORMANCE.md](./PERFORMANCE.md)
* **API Index** → [../api/INDEX.md](../api/INDEX.md)
* **Why not raw `MutationObserver`?** → [../WHY_NOT_MUTATION_OBSERVER.md](../WHY_NOT_MUTATION_OBSERVER.md)
