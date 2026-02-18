# Examples Library

This document collects practical DomChangeObserver patterns you can copy‑paste and adapt.

DomChangeObserver is **reporting-only**: it observes DOM changes and emits structured batches.
It does not schedule work, mutate state, or attach jobs.

---

## Common setup

### Standalone (no m7-lib)

```js
import DomChangeObserver from "../../src/DomChangeObserver.js";

const obs = new DomChangeObserver({
  root: document.body,
});
```

### m7-lib (`install.js`, recommended)

```js
import installDomChangeObserver from "../../src/install.js";

installDomChangeObserver(lib, {
  host: window,
  root: document.body,
  start: false,
});

const obs = lib.service.get("primitive.dom.changeobserver");

// Optional: set root explicitly if your env doesn’t provide one
// obs.setRoot(document.body);
```

---

## 1) Global handler (onChange)

Use `onChange` when you want an **aggregated view** across all selectors.

```js
obs.configure({
  onChange(batch) {
    // Minimal work here — capture, enqueue, return.
    console.log("batch selectors:", batch.selectors);

    for (const rec of batch.added) {
      console.log("added:", rec.el, rec.selectors);
    }

    for (const rec of batch.removed) {
      console.log("removed:", rec.el, rec.selectors);
    }

    for (const rec of batch.changed) {
      console.log("became match:", rec.el, rec.selectors);
    }

    for (const rec of batch.changeAway) {
      console.log("stopped match:", rec.el, rec.selectors);
    }
  },
});

obs.addSelector(".active");
obs.addSelector("[data-track]");
obs.start();
```

Notes:

* `changed` and `changeAway` are **selector membership transitions** caused by attribute changes.
* If attribute observation is disabled (globally or for a selector), `changed` / `changeAway` remain empty.

---

## 2) Per-selector handler (onEvent)

Use `onEvent` when you want a **selector-scoped view**.

```js
obs.addSelector(".active", {
  onEvent(evt) {
    // Only records relevant to this selector
    for (const rec of evt.added) console.log(".active added", rec.el);
    for (const rec of evt.removed) console.log(".active removed", rec.el);
    for (const rec of evt.changed) console.log(".active became match", rec.el);
    for (const rec of evt.changeAway) console.log(".active stopped match", rec.el);
  },

  // Optional: enable attribute-driven transitions for this selector
  observeAttributes: true,
  attributeFilter: ["class"],
});

obs.start();
```

Per-selector events fire **in addition** to the global `onChange` handler (if configured).

---

## 3) “Easy button”: most common configuration

The common "set it and forget it" pattern:

* One root
* A handful of selectors
* Global `onChange` only
* No subtree matching unless you truly need it

```js
const obs = new DomChangeObserver({
  root: document.body,
  selectors: [".active", "[data-track]"],

  // Conservative defaults
  includeSubtreeMatches: false,
  observeAttributes: false,

  onChange(batch) {
    // Push to your queue / event bus
    // queue.push(batch);
  },
});

obs.start();
```

---

## 4) Attribute-driven membership transitions

If you want `changed` / `changeAway`, enable attribute observation.

### Global intent

```js
obs.configure({
  observeAttributes: true,
  attributeFilter: ["class", "data-state"],
});

obs.addSelector(".active");
obs.addSelector("[data-state=ready]");
obs.start();
```

### Per-selector intent

```js
obs.addSelector(".active", {
  observeAttributes: true,
  attributeFilter: ["class"],
});

obs.addSelector("[data-state=ready]", {
  observeAttributes: true,
  attributeFilter: ["data-state"],
});

obs.start();
```

---

## 5) Subtree matching (be intentional)

Subtree matching will scan descendants via `querySelectorAll()` when nodes are added/removed.

Use it only when you need the semantics.

```js
obs.addSelector(".active", {
  includeSubtreeMatches: true,
});

obs.start();
```

For cost details, see: [PERFORMANCE.md](./PERFORMANCE.md)

---

## 6) “Capture then queue” pattern (recommended)

Event handlers are synchronous. Keep them lightweight.

```js
const queue = [];

obs.configure({
  debounceMs: 10,
  onChange(batch) {
    // Minimal work: capture and return
    queue.push(batch);
  },
});

obs.start();

// Elsewhere: process queue on your schedule
function drain() {
  while (queue.length) {
    const batch = queue.shift();
    // process(batch)
  }
}
```

---

## Related docs

* [Quick Start](./QUICKSTART.md)
* [Installation](./INSTALLATION.md)
* [Performance Notes](./PERFORMANCE.md)
* [API Reference](../api/INDEX.md)
* [Why not raw `MutationObserver`?](../WHY_NOT_MUTATION_OBSERVER.md)
