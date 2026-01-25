# `auto.js` Integration Reference

`auto.js` is an **optional** convenience layer that registers DomChangeObserver into the **m7-lib** global (`globalThis.lib`).

If you are not using m7-lib (bundlers, tests, standalone modules), you do **not** need `auto.js`.

---

## What `auto.js` does

When loaded in a browser environment with `globalThis.lib` available, `auto.js`:

1. Ensures the `lib.primitive.dom.changeobserver` namespace exists (via `lib.hash.set`)

2. Exposes the public constructor:

   * `lib.primitive.dom.changeobserver.DomChangeObserver`

3. Creates a **default observer instance** and registers it as a service:

   * `lib.service.set("primitive.dom.changeobserver", instance)`

4. Optionally exposes the instance on the namespace:

   * `lib.primitive.dom.changeobserver.instance`

`auto.js` is registration and wiring only.

It does **not** start observation automatically.

---

## Requirements

`auto.js` expects:

* `m7-lib` loaded first (provides `globalThis.lib`)
* `lib.hash.set` available
* `lib.service.set` available

If any of these are missing, `auto.js` throws immediately.

---

## Recommended load order

```html
<!-- Load m7-lib (creates global `lib`) -->
<script src="/lib/m7-lib.min.js"></script>

<!-- Then load changeobserver auto.js as a module -->
<script type="module" src="/lib/dom/changeobserver/auto.js"></script>
```

---

## What gets registered

After `auto.js` executes, you can access:

### Constructor

```js
const DomChangeObserver = lib.primitive.dom.changeobserver.DomChangeObserver;
```

### Default instance (service)

```js
const obs = lib.service.get("primitive.dom.changeobserver");
```

### Default instance (namespace)

```js
const obs = lib.primitive.dom.changeobserver.instance;
```

---

## Default root resolution

`auto.js` attempts to select a reasonable default root from `lib._env` (if present):

* `lib._env.root.document.body`, then
* `lib._env.root.document`, then
* `null`

If the resolved root is `null`, you must explicitly call `setRoot(...)` before `start()`.

---

## Default configuration

The default instance is configured conservatively:

* `debounceMs: 0`
* `includeSubtreeMatches: false`
* `observeAttributes: false`
* `attributeFilter: null`
* `onChange: null` (no global emission until a consumer attaches one)

This is intentional: the primitive installs cleanly without producing events by itself.

---

## Basic usage

```js
const obs = lib.service.get("primitive.dom.changeobserver");

obs.configure({
  selectors: [".active"],
  onChange(batch) {
    console.log(batch);
  },
});

obs.start();
```

---

## Troubleshooting

| Symptom                          | Likely cause                           | Fix                                          |
| -------------------------------- | -------------------------------------- | -------------------------------------------- |
| `lib is undefined`               | m7-lib not loaded (or loaded too late) | Load m7-lib first                            |
| `requires lib.hash.set`          | incomplete m7-lib build                | include hash/registry modules                |
| `requires lib.service`           | service registry missing               | include service registry / `lib.service.set` |
| `start(): no DOM root available` | default root resolved to `null`        | pass `opts.root` or call `setRoot(...)`      |

---

## Notes

* `auto.js` should remain dependency-light.
* In module/bundler environments, you typically do **not** need `auto.js`.
* `auto.js` does not introduce any async behavior.

---

## Related Docs

* **Installation** → [../usage/INSTALLATION.md](../usage/INSTALLATION.md)
* **Quick Start** → [../usage/QUICKSTART.md](../usage/QUICKSTART.md)
* **Handlers** → [EVENT_HANDLERS.md](./EVENT_HANDLERS.md)
* **API Index** → [INDEX.md](./INDEX.md)
