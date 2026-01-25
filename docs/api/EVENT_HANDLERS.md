# Event Handlers

DomChangeObserver supports two optional user-defined handlers:

* `onChange` — global batch handler (fires for every delivered batch)
* `onEvent` — per-selector handler (fires only when that selector has relevant records)

Both handlers are:

* invoked **synchronously**
* **best-effort** (errors are swallowed)
* never awaited

If you want async behavior, enqueue work and return.

---

## Global handler — `onChange(batch)`

### When it runs

`onChange` runs when a mutation batch is delivered.

Delivery occurs:

* immediately after a mutation batch is observed (default), or
* after a debounce window (`debounceMs`) if configured

`onChange` receives the **full aggregated batch** across all enabled selectors.

If no `onChange` is provided, the observer still tracks internal state and per-selector statistics; it simply does not emit a global event.

### Signature

```js
function onChange(batch) {
  // ...
}
```

### Parameters

* `batch` (`DomChangeBatch`)

  A structured change batch containing selector-relevant lifecycle buckets:

  * `added` — elements newly present and matching selectors
  * `removed` — elements removed while matching selectors (best-effort)
  * `changed` — non-match → match membership transitions (attribute-driven)
  * `changeAway` — match → non-match membership transitions (attribute-driven)

  Each record has:

  * `el` — the affected element
  * `selectors` — the enabled selectors that matched that element at capture time

### Typical uses

Keep this lightweight:

* push the batch into a queue
* increment counters
* publish a signal to your event bus

Example: capture then queue

```js
const queue = [];

const obs = new DomChangeObserver({
  root: document.body,
  onChange(batch) {
    queue.push(batch);
  }
});

obs.addSelector(".active");
obs.start();
```

---

## Per-selector handler — `onEvent(evt)`

### When it runs

`onEvent` runs only when a specific selector has **any relevant records** in the delivered batch.

It receives a **selector-scoped view** of the same lifecycle buckets:

* `added`
* `removed`
* `changed`
* `changeAway`

Per-selector events fire **in addition** to the global `onChange` handler (if configured).

### Signature

```js
function onEvent(evt) {
  // ...
}
```

### Parameters

* `evt` (`SelectorEvent`)

  Fields:

  * `at` — timestamp when this selector event was delivered
  * `selector` — the selector this event applies to
  * `added` / `removed` / `changed` / `changeAway` — selector-scoped record arrays
  * `batchAt` — timestamp of the originating batch
  * `enabledSelectors` — snapshot of enabled selectors at delivery time

  Notes:

  * Records may list multiple selectors (the event is scoped by `evt.selector`).
  * `changed` / `changeAway` are membership transitions, not “all attribute changes”.

### Typical uses

* route selector-scoped changes to dedicated handlers
* maintain per-feature state without re-filtering the global batch

Example: per-selector handler with attribute transitions

```js
const obs = new DomChangeObserver({ root: document.body });

obs.addSelector(".active", {
  observeAttributes: true,
  attributeFilter: ["class"],
  onEvent(evt) {
    for (const r of evt.added) console.log(".active added", r.el);
    for (const r of evt.removed) console.log(".active removed", r.el);
    for (const r of evt.changed) console.log(".active became match", r.el);
    for (const r of evt.changeAway) console.log(".active stopped match", r.el);
  }
});

obs.start();
```

---

## Synchronous handler rules

Because handlers are synchronous:

* **Never** block (avoid heavy loops)
* **Never** await
* Avoid triggering layout / render work in the handler

If you need async work:

* push into a queue
* schedule work elsewhere

See: [../usage/EXAMPLES_LIBRARY.md](../usage/EXAMPLES_LIBRARY.md)

---

## Error behavior

Handler failures are swallowed.

This means:

* a broken handler will not crash observation
* you must test handlers if you rely on them
* add your own try/catch if you want fallback behavior

Example: internal fallback

```js
obs.configure({
  onChange(batch) {
    try {
      ship(batch);
    } catch (err) {
      // your fallback, your policy
    }
  }
});
```

---

## Related Docs

* **API Index** → [INDEX.md](./INDEX.md)
* **DomChangeObserver** → [DOM_CHANGE_OBSERVER.md](./DOM_CHANGE_OBSERVER.md)
* **Installation** → [../usage/INSTALLATION.md](../usage/INSTALLATION.md)
* **Examples Library** → [../usage/EXAMPLES_LIBRARY.md](../usage/EXAMPLES_LIBRARY.md)
* **Performance Notes** → [../usage/PERFORMANCE.md](../usage/PERFORMANCE.md)
* **Why not raw `MutationObserver`?** → [../WHY_NOT_MUTATION_OBSERVER.md](../WHY_NOT_MUTATION_OBSERVER.md)
