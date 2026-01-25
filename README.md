# m7-js-lib-primitive-dom-changeobserver

A selector-aware DOM change reporting primitive built on top of `MutationObserver`.

This project exists because most uses of `MutationObserver` quickly accumulate ad-hoc logic, hidden policy, and unclear semantics around what it actually means for the DOM to have “changed”.

This library does one thing well: **observe DOM changes and report structured, selector-relevant facts — nothing more.**

It is a primitive, not a framework.

---

## Navigation

If you are new to the project, the recommended reading order is:

1. **Quick Start** → [docs/usage/QUICKSTART.md](docs/usage/QUICKSTART.md)
2. **Usage TOC** → [docs/usage/TOC.md](docs/usage/TOC.md)
3. **API Index** → [docs/api/INDEX.md](docs/api/INDEX.md)

Related meta documents:

* **Why not raw `MutationObserver`?** → [docs/WHY_NOT_MUTATION_OBSERVER.md](docs/WHY_NOT_MUTATION_OBSERVER.md)
* **Use Policy** → [docs/USE_POLICY.md](docs/USE_POLICY.md)
* **AI Disclosure** → [docs/AI_DISCLOSURE.md](docs/AI_DISCLOSURE.md)

---

## Why this exists

If you have ever:

* Used `MutationObserver` and had to manually reconcile added vs removed nodes
* Needed to know when an element **became relevant** to a selector
* Needed to know when an element **stopped matching** a selector
* Wanted DOM observation without immediately attaching behavior
* Needed batching semantics instead of raw mutation records
* Been bitten by browser vs jsdom / test-environment differences

Then you have already discovered the limits of raw DOM mutation APIs.

This library solves those problems by separating **observation** from **policy**.

---

## What this library guarantees

* DOM changes are observed via `MutationObserver`
* Changes are reported in explicit lifecycle buckets:

  * `added`
  * `removed`
  * `changed` (non-match → match)
  * `changeAway` (match → non-match)
* Selector *membership transitions* are tracked explicitly
* Delivery is batch-based
* Both global and per-selector reporting are supported
* No side effects are performed by the library
* No jobs are attached or scheduled

These guarantees are enforced by design, not convention.

---

## Quick example

```js
import DomChangeObserver from "./DomChangeObserver.js";

const obs = new DomChangeObserver({
  root: document.body,
  selectors: [
    {
      selector: ".active",
      onEvent(evt) {
        console.log(".active selector event:", evt);
      }
    }
  ],
  onChange(batch) {
    console.log("DOM batch:", batch);
  }
});

obs.start();
```

By default this:

* Observes the DOM synchronously
* Batches mutations
* Tracks selector membership changes
* Does **not** mutate application state
* Does **not** schedule async work

---

## Core concepts

### Observation root

A single DOM root is observed at any given time.

* Resolved once at construction or via `setRoot()`
* Explicitly changeable
* All observation is scoped to this root

---

### Selectors

Selectors define **what is relevant**.

Each selector may independently control:

* Enable / disable state
* Subtree matching
* Attribute observation intent
* Attribute filters
* Optional per-selector event handler (`onEvent`)

Selectors scope reporting; they do not run behavior.

---

### Lifecycle buckets

Each delivered batch may include:

* **added**
  Elements newly present and matching selectors

* **removed**
  Elements removed while matching selectors (best-effort)

* **changed**
  Elements that transitioned from NOT matching → matching

* **changeAway**
  Elements that transitioned from matching → NOT matching

These are **membership transitions**, not raw mutation logs.

---

## Reporting, not behavior

This library does not:

* Attach jobs
* Run application logic
* Mutate state
* Schedule async work
* Impose policy

It reports **what happened**.
Consumers decide **what to do**.

This makes DomChangeObserver safe to use as shared infrastructure.

---

## Performance notes

### Subtree matching

When subtree matching is enabled, added or removed nodes may be scanned using `querySelectorAll()`.

Worst-case cost:

```
O(number of selectors × number of descendants)
```

Consumers should:

* Enable subtree matching only when semantically required
* Keep roots narrow
* Scope selectors carefully

→ See [docs/usage/PERFORMANCE.md](docs/usage/PERFORMANCE.md)

---

## Environment support

* **Browsers**: supported
* **Node + jsdom**: supported via host injection
* **Plain Node (no DOM)**: not supported (by design)

CharacterData (text node) mutations are intentionally not observed.

---

## What this library does not do

This project is intentionally scoped.

It does not:

* React to DOM changes
* Perform rendering or templating
* Track text content changes
* Guarantee delivery
* Provide framework integrations
* Replace reactivity systems

Those belong in higher layers.

---

## Documentation map

* **Quick Start** → [docs/usage/QUICKSTART.md](docs/usage/QUICKSTART.md)
* **Usage TOC** → [docs/usage/TOC.md](docs/usage/TOC.md)
* **Examples** → [examples/](examples/)
* **Examples LIBRARY** → [docs/usage/EXAMPLES_LIBRARY.md](docs/usage/EXAMPLES_LIBRARY.md)
* **Performance Notes** → [docs/usage/PERFORMANCE.md](docs/usage/PERFORMANCE.md)
* **API Index** → [docs/api/INDEX.md](docs/api/INDEX.md)

---

## Philosophy

> “Observe precisely. Decide elsewhere.”

Avoid embedding policy where correctness and composability matter.

---

## License

See [LICENSE.md](LICENSE.md) for full terms.

* Free for personal, non-commercial use
* Commercial licensing available under the M7 Moderate Team License (MTL-10)

---

## AI Usage Disclosure

See:

* [docs/AI_DISCLOSURE.md](docs/AI_DISCLOSURE.md)
* [docs/USE_POLICY.md](docs/USE_POLICY.md)

for permitted use of AI in derivative tools or automation layers.

---

## Feedback / Security

* General inquiries: [legal@m7.org](mailto:legal@m7.org)
* Security issues: [security@m7.org](mailto:security@m7.org)
