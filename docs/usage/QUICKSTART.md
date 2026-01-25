# Quick Start — DomChangeObserver

This guide gets you **observing meaningful DOM changes** in under 2 minutes.

No jobs. No side effects. No hidden policy.

DomChangeObserver reports *what changed* — you decide *what to do*.

---

## 1) Minimal setup

### Browser (standalone)

```js
import DomChangeObserver from "../../src/DomChangeObserver.js";

const observer = new DomChangeObserver({
  root: document.body,
});
```

At this point:

* Nothing is running
* No observation has started
* No handlers are attached

DomChangeObserver is inert until you explicitly start it.

---

## 2) Add a selector

Selectors define *what is relevant*.

```js
observer.addSelector(".active");
```

Nothing happens yet — selectors scope reporting, they do not trigger behavior.

---

## 3) Attach a global handler (optional)

Use `onChange` when you want a **single aggregated view** of all selectors.

```js
observer.configure({
  onChange(batch) {
    console.log("added", batch.added);
    console.log("removed", batch.removed);
    console.log("changed", batch.changed);
    console.log("changeAway", batch.changeAway);
  }
});
```

Handlers are:

* synchronous
* best-effort
* reporting-only

Keep them lightweight.

---

## 4) Start observing

```js
observer.start();
```

Observation begins immediately.

From this point on:

* DOM mutations are observed
* Changes are batched
* Selector membership transitions are tracked

---

## 5) Per-selector handler (alternative)

Instead of a global handler, you can attach selector-scoped handlers.

```js
observer.addSelector(".active", {
  observeAttributes: true,
  attributeFilter: ["class"],

  onEvent(evt) {
    console.log(".active added", evt.added);
    console.log(".active removed", evt.removed);
    console.log(".active became match", evt.changed);
    console.log(".active stopped match", evt.changeAway);
  }
});

observer.start();
```

Per-selector events fire **in addition** to the global handler (if configured).

---

## 6) What you get

Each delivered batch contains **selector-relevant lifecycle buckets**:

* `added` — elements newly present and matching
* `removed` — elements removed while matching (best-effort)
* `changed` — non-match → match transitions
* `changeAway` — match → non-match transitions

These are **membership transitions**, not raw mutation records.

---

## 7) Stop / restart (optional)

```js
observer.stop();

// ... later ...
observer.start();
```

Stopping detaches the underlying MutationObserver.

No background work continues while stopped.

---

## Common first-time mistakes

| Mistake                      | Result                        |
| ---------------------------- | ----------------------------- |
| Forgetting to call `start()` | No events are emitted         |
| No selectors configured      | Nothing is reported           |
| Heavy work in handlers       | UI jank / blocking            |
| Expecting text changes       | CharacterData is not observed |

---

## Next steps

* **Examples Library** → [EXAMPLES_LIBRARY.md](./EXAMPLES_LIBRARY.md)
* **Installation options** → [INSTALLATION.md](./INSTALLATION.md)
* **Performance notes** → [PERFORMANCE.md](./PERFORMANCE.md)
* **API reference** → [../api/INDEX.md](../api/INDEX.md)
* **Why not raw `MutationObserver`?** → [../WHY_NOT_MUTATION_OBSERVER.md](../WHY_NOT_MUTATION_OBSERVER.md)

---

> Observe precisely. Decide elsewhere.
