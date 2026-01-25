# API Index — DomChangeObserver

This directory contains the **spec-style API references** for the DomChangeObserver primitive.

If you’re new to the project, start with:

* **Docs TOC** → [../usage/TOC.md](../usage/TOC.md)
* **Quick Start** → [../usage/QUICKSTART.md](../usage/QUICKSTART.md)
* **Project README** → [../../README.md](../../README.md)

> This library is intentionally small. There is no Manager/Worker model — you work with the observer directly.

---

## Core API

* **DomChangeObserver** → [DOM_CHANGE_OBSERVER.md](./DOM_CHANGE_OBSERVER.md)

  The primary class: observes a DOM root and reports selector-relevant change batches.

---

## Handlers

* **Event Handlers** → [EVENT_HANDLERS.md](./EVENT_HANDLERS.md)

Defines the two supported handler types:

* Global batch handler: `onChange(batch)`
* Per-selector handler: `onEvent(evt)`

Both are synchronous, best-effort, and never awaited.

---

## Integration

* **auto.js** → [AUTO.md](./AUTO.md)

Optional browser convenience that registers the primitive into `lib.primitive.dom.changeobserver` and installs a shared instance as a service (m7-lib).

---

## Contracts

* **DomChangeObserver Contract (LLM/tooling-safe)** → [DOM_CHANGE_OBSERVER_API_CONTRACT.md](./DOM_CHANGE_OBSERVER_API_CONTRACT.md)

Source-independent behavioral guarantees intended for tooling, integration layers, and LLM guidance.

---

## Related Usage Docs

* **Installation** → [../usage/INSTALLATION.md](../usage/INSTALLATION.md)
* **Examples Library** → [../usage/EXAMPLES_LIBRARY.md](../usage/EXAMPLES_LIBRARY.md)
* **Performance Notes** → [../usage/PERFORMANCE.md](../usage/PERFORMANCE.md)

---

## Navigation

* **Docs TOC** → [../usage/TOC.md](../usage/TOC.md)
* **Project root README** → [../../README.md](../../README.md)
