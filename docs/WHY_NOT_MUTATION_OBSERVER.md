# Why Not Raw `MutationObserver`?

`MutationObserver` is a powerful low-level API.

It is not a complete observation strategy on its own.

---

## 1) Raw mutation records are not semantic changes

`MutationObserver` reports *mechanical facts*:

* a node was added
* a node was removed
* an attribute changed

It does **not** tell you:

* whether the change is relevant
* whether an element became important
* whether something *stopped* being relevant
* how multiple mutations relate to each other

Most real applications care about **meaning**, not mechanics.

A primitive that reports selector membership transitions bridges that gap.

---

## 2) Selector logic gets re‑implemented everywhere

When developers consume raw mutation records, they almost always write code like:

```js
if (el.matches(selector)) {
  // do something
}
```

Then later:

```js
if (wasMatching && !el.matches(selector)) {
  // do something else
}
```

Over time this leads to:

* duplicated selector checks
* subtle ordering bugs
* inconsistent definitions of “changed”
* missed edge cases around removal and reinsertion

A selector-aware primitive centralizes this logic so it is **correct once**, not reimplemented repeatedly.

---

## 3) MutationObserver is too low-level for batching

`MutationObserver` delivers records in microtasks.

That is *not* the same as:

* a meaningful change event
* a stable snapshot of state
* a coherent batch of related mutations

Consumers typically end up building their own batching layers:

* debouncing
* grouping by selector
* collapsing redundant mutations

DomChangeObserver formalizes batching as a first-class concept.

---

## 4) Removal and “change away” are easy to get wrong

Raw mutation records tell you *what was removed*, not *what stopped being relevant*.

Common failure modes:

* elements removed before you can test selectors
* attribute changes that invalidate a selector
* reinserted nodes leaking old state

Detecting **membership transitions** (match → non-match) reliably requires:

* tracking prior state
* coordinating structural and attribute mutations
* clearing state at the right boundaries

This is difficult to do correctly ad hoc.

---

## 5) Raw observers encourage side effects

Most uses of `MutationObserver` look like this:

```js
new MutationObserver(records => {
  // immediately do something
});
```

This couples:

* observation
* decision
* behavior

into a single step.

That makes the system:

* harder to test
* harder to reason about
* harder to reuse

A reporting primitive separates **observation** from **policy**.

---

## 6) Environment differences leak into application code

Using `MutationObserver` directly often exposes environment issues:

* browser vs jsdom
* missing globals
* cross-realm node identity

These details do not belong in application logic.

A well-defined primitive absorbs environment variance so consumers see a stable interface.

---

## When raw `MutationObserver` *is* enough

Using `MutationObserver` directly is fine when:

* you need only a single, simple signal
* selector semantics do not matter
* the code is small or disposable
* batching and history are unnecessary

It is a tool — just not a system.

---

## The takeaway

`MutationObserver` reports *what happened mechanically*.

A selector-aware primitive reports *what changed meaningfully*.

One is a building block.

The other is an observation contract.

---

> Observe first. Decide elsewhere.
