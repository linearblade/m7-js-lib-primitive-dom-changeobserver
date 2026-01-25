// dom/changeobserver/auto.js
//
// Registers this primitive into the m7-lib hierarchy when running in a browser
// with `globalThis.lib` available.
//
// This file is OPTIONAL for standalone usage. It exists only for m7-lib wiring.

import DomChangeObserver from "./DomChangeObserver.reobserve.js";

const MOD = "[primitive.dom.changeobserver]";

// Resolve host/global root
const host =
    (typeof globalThis !== "undefined") ? globalThis :
    (typeof window !== "undefined") ? window :
    (typeof global !== "undefined") ? global :
    undefined;

const lib = host?.lib || null;

if (!lib) {
    throw new Error(`${MOD} requires global lib (browser environment).`);
}

if (typeof lib?.hash?.set !== "function") {
    throw new Error(`${MOD} requires lib.hash.set (m7-lib not installed or incomplete).`);
}

if (!lib.service || typeof lib.service.set !== "function") {
    throw new Error(`${MOD} requires lib.service (service registry not installed).`);
}

// Exportable module object (structure / namespace)
const changeobserver = {
    DomChangeObserver,
};

// Register module into lib hierarchy (structure)
lib.hash.set(lib, "primitive.dom.changeobserver", changeobserver);

// ─────────────────────────────────────────
// Service registration
// ─────────────────────────────────────────

// Resolve a reasonable default root from lib._env if present
const defaultRoot =
    lib?._env?.root?.document?.body ??
    lib?._env?.root?.document ??
    null;

// Create a default observer instance
const changeObserver = new DomChangeObserver({
    host,
    root: defaultRoot,
});

// Apply a boring, safe default global configuration.
// Consumers are free to override any of this later via configure().
changeObserver.configure({
    debounceMs: 0,
    includeSubtreeMatches: false,
    observeAttributes: false,
    attributeFilter: null,
    onChange: null, // no-op by default; subsystems attach explicitly
});

// Register as a service
lib.service.set("primitive.dom.changeobserver", changeObserver);

// Optional export of instance on the namespace
changeobserver.instance = changeObserver;

// Exports
export { changeobserver, changeObserver, DomChangeObserver };
export default changeobserver;
