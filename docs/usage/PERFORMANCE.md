# Performance Notes — DomChangeObserver

DomChangeObserver is designed to be **predictable and explicit** about performance costs.

Performance is treated as a first-class concern, but it is enforced through **clear responsibility boundaries**, not hidden optimizations or heuristics.

---

## What the primitive optimizes for

The core performance guarantees are:

* **Synchronous observation** with predictable cost
* **No hidden async work** beyond optional batching
* **No implicit scheduling** or background processing
* **Selector-scoped work**, not global scans

In practice, a mutation batch:

* Receives MutationObserver records
* Matches affected elements against enabled selectors
* Updates minimal internal state
* Emits a structured report

Nothing is awaited. Nothing is scheduled implicitly.

---

## What is intentionally *not* optimized

DomChangeObserver does **not** attempt to optimize:

* Application behavior
* Job scheduling
* Side effects
* Rendering or reflow
* Framework integration
* Persistence or export

Those concerns belong to higher layers.

This primitive reports facts; it does not decide policy.

---

## Selector matching cost

Selector matching is the dominant cost in this system.

Costs depend on:

* Number of enabled selectors
* Selector complexity
* Whether subtree matching is enabled
* Size of added/removed subtrees

When subtree matching is enabled, the worst-case cost per mutation batch is:

```
O(number of selectors × number of descendants)
```

This is not hidden.

Consumers should:

* Enable subtree matching only when semantically required
* Scope selectors narrowly
* Use a constrained observation root

---

## Attribute observation cost

Attribute-driven membership tracking requires:

* Tracking prior match state per element
* Re-evaluating selectors on attribute mutation

Costs scale with:

* Number of attribute-observing selectors
* Frequency of attribute mutations

Recommendations:

* Disable attribute observation unless required
* Use `attributeFilter` aggressively
* Prefer structural signals where possible

---

## Batching and debounce

DomChangeObserver batches mutations into coherent delivery units.

* Batching is synchronous by default
* Optional debounce introduces a deliberate delay
* No background timers are created unless debounce is enabled

Debounce trades latency for reduced delivery frequency.

---

## Removal and membership tracking

Correctly tracking removals and membership transitions requires:

* Snapshotting match state
* Clearing state on removal
* Avoiding leaks across reinsert cycles

This bookkeeping has a small constant cost but avoids expensive recomputation later.

---

## Event handlers should be lightweight

Global `onChange` and per-selector `onEvent` handlers are synchronous.

They should:

* Do minimal work
* Avoid blocking
* Avoid triggering layout or rendering

If work may be slow:

> Capture the data, enqueue the work, and return.

---

## Environment considerations

DomChangeObserver absorbs environment differences:

* Browser vs jsdom
* Realm-specific MutationObserver implementations

These checks are performed once per lifecycle, not per mutation.

---

## The contract

This library guarantees:

* Predictable, bounded work per mutation batch
* No surprise background activity
* Explicit performance tradeoffs

The consumer controls:

* Selector design
* Observation scope
* Batching strategy
* Downstream behavior

---

> Observe precisely. Decide elsewhere.
