# DomChangeObserver

DomChangeObserver is the **single core primitive** in this repository.

It observes a DOM root via `MutationObserver`, matches elements against a selector registry, and reports **selector-relevant** changes in coherent batches.

It is reporting-only.

It does not schedule work, attach jobs, or mutate application state.

---

## Constructor

### `new DomChangeObserver(opts?)`

```js
import DomChangeObserver from "../../src/DomChangeObserver.js";

const obs = new DomChangeObserver({
  root: document.body,
  selectors: [".active", "[data-track]"],
  onChange(batch) {
    // reporting-only
  }
});
```

### Options

The constructor accepts `DomChangeObserverOptions`:

* `root` *(Element | Document | DocumentFragment | null)*

  * Observation root.
  * If omitted, a best-effort default root is resolved from the host (`document.body` → `document.documentElement` → `document`).

* `host` *(any | null)*

  * Optional realm/host injection point (useful for jsdom) used for default root + same-realm `MutationObserver` resolution.

* `selectors` *(SelectorInput)*

  * Initial selector(s) to register.
  * Strings are shorthand; selector specs allow per-selector option locking.

* `includeSubtreeMatches` *(boolean)*

  * Global default/fallback for subtree matching.

* `observeAttributes` *(boolean)*

  * Global default/fallback for attribute-driven membership tracking.

* `attributeFilter` *(string|string[]|null)*

  * Global default/fallback attribute filter.
  * The effective observer `attributeFilter` is computed as a **union** across enabled selectors.

* `debounceMs` *(number)*

  * Delivery debounce in milliseconds.

* `onChange` *(function | null)*

  * Optional global batch handler.

---

## High-level semantics

DomChangeObserver emits four lifecycle buckets:

* `added`

  * Elements newly present in the observed subtree and matching one or more enabled selectors **at collection time** (during mutation processing).

  Note: selector matches are not re-evaluated at delivery time.

* `removed`

  * Elements removed from the observed subtree that matched one or more enabled selectors at removal time (best-effort).

  Note: collection is performed during mutation processing; delivery may be deferred.

* `changed`

  * Membership transition: **non-match → match**, driven by attribute mutations.

* `changeAway`

  * Membership transition: **match → non-match**, driven by attribute mutations.

Important notes:

* `changed` / `changeAway` are **membership transitions**, not “all attribute changes”.
* If attribute observation is disabled (globally or per selector), `changed` / `changeAway` remain empty.
* CharacterData (text-node) mutations are not observed or supported.

---

## Lifecycle API

### `start()`

Starts observation.

Behavior:

* If already running: no-op, returns `true`.
* Validates that a valid root exists.
* Validates that a compatible `MutationObserver` constructor is available.
* Attaches an observer using the effective observation options.

Returns: `true`

### `stop()`

Stops observation and clears transient runtime state.

Effects:

* disconnects the underlying `MutationObserver`
* cancels any scheduled delivery timer
* clears pending (undelivered) records
* resets attribute match baseline

Does NOT:

* remove selectors
* reset selector statistics

### `pause()` / `resume()`

* `pause()` disconnects without clearing pending records.
* `resume()` is an alias of `start()`.

### `state()` / `isRunning()`

* `state()` → `"running" | "paused"`
* `isRunning()` → boolean

---

## Root management

### `setRoot(newRoot, host?)`

Sets a new observation root.

* Replaces the internal single-source-of-truth root reference.
* If running, detaches from the old root and re-attaches to the new root.
* Optional `host` updates the realm used for `MutationObserver` resolution.

Returns:

* `true` if the root changed
* `false` if `newRoot` is identical to the current root

---

## Selector registry

Selectors define what is relevant.

They may be:

- enabled or disabled
- configured with per-selector options locked at registration time

### `addSelector(selector, opts?)`

Registers a selector.

Returns:

* `true` if added
* `false` if invalid or already present

Per-selector options (locked at registration time):

* `enabled` *(boolean)*
* `onEvent(evt)` *(function)*
* `observeAttributes` *(boolean)*
* `attributeFilter` *(string|string[]|null)*
* `includeSubtreeMatches` *(boolean)*

### `removeSelector(selector)`

Removes a selector and scrubs pending state.

### `pauseSelector(selector, opts?)` / `resumeSelector(selector)`

* Pause a selector without removing it.
* Optional `dropPending` scrubs pending records for that selector.

### `setSelectorEnabled(selector, on)`

Hard enable/disable.

### `setSelectors(selectors)`

Hard reset: replaces the entire registry.

Effects:

* clears pending records
* resets attribute match baseline
* discards selector entries and per-selector stats

### Introspection helpers

* `hasSelector(selector)`
* `getSelector(selector, opts?)`
* `listSelectors(opts?)`
* `getSelectors()`

Returns the list of currently **enabled** selector strings.

---

## Delivery and pull-style consumption

### `flush()`

Forces immediate delivery of pending changes.

* Cancels an active debounce timer (if any)
* Delivers a batch immediately (if pending)

Returns: `DomChangeBatch | null`

### `takePending()`

Pull-style consumption.

Returns the current pending batch **without** invoking handlers.

Returns: `DomChangeBatch | null`

---

## Re-observation behavior

The underlying `MutationObserver` options are computed from:

* global defaults
* enabled selectors that opt into attribute observation
* unioned attribute filters

If registry changes alter effective observer options (e.g. attributes become required, union changes), DomChangeObserver will safely re-observe while running.

This is automatic.

---

## Performance notes (API-level)

* Subtree matching may scan descendants via `querySelectorAll()` per selector.
* Attribute observation requires re-evaluating selector membership on attribute mutations.

See: [../usage/PERFORMANCE.md](../usage/PERFORMANCE.md)

---

## Handler behavior

Handler failures are swallowed; observation continues.

---

## Error behavior

The following methods may throw:

* `start()`  
  Throws if no valid DOM root is available or if `MutationObserver` is missing.

* `setRoot(newRoot)`  
  Throws if `newRoot` is not a valid `Element`, `Document`, or `DocumentFragment`.

* `configure(cfg)`  
  Throws if `cfg.root` is provided (root changes must use `setRoot()`).

* `stop()` / `pause()`  
  May throw if disconnecting the underlying observer fails (rare; best-effort).

All other methods are best-effort and do not throw under normal usage.

---

## Related docs

* **API Index** → [INDEX.md](./INDEX.md)
* **Handlers** → [EVENT_HANDLERS.md](./EVENT_HANDLERS.md)
* **auto.js** → [AUTO.md](./AUTO.md)
* **Contract** → [DOM_CHANGE_OBSERVER_API_CONTRACT.md](./DOM_CHANGE_OBSERVER_API_CONTRACT.md)
