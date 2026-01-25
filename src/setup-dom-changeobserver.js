// setup-dom-changeobserver.js
// Page-level configuration for the shared DomChangeObserver service.
// This sets only global knobs (no selectors, no root unless you want it).

const MOD = "[setup.dom.changeobserver]";

const lib = globalThis?.lib;
if (!lib) throw new Error(`${MOD} requires global lib`);

if (!lib.service || typeof lib.service.get !== "function") {
  throw new Error(`${MOD} requires lib.service.get`);
}

const obs = lib.service.get("primitive.dom.changeobserver");
if (!obs) {
  throw new Error(`${MOD} missing service: primitive.dom.changeobserver`);
}

// Pull optional page config from wherever you like.
// You can wire this to lib.hash / env / inline config later.
const cfg = lib.hash?.get?.(lib, "page.dom.changeobserver") || {};

// ---- Global knobs only ----
obs.configure({
  // debounceMs is the classic global knob
  debounceMs: Number.isFinite(cfg.debounceMs) ? cfg.debounceMs : 0,

  // Global defaults/fallbacks used when selector specs omit values
  includeSubtreeMatches: cfg.includeSubtreeMatches ?? false,
  observeAttributes: cfg.observeAttributes ?? false,

  // If you want a global fallback attributeFilter
  // (selectors can still supply their own filter)
  attributeFilter: cfg.attributeFilter ?? null,

  // Leave onChange null here — let subsystems attach a dispatcher
  onChange: null,
});

// Optional: set root here if you want a single global root.
// Most pages will stick with the default resolved root and skip this.
// if (cfg.root) obs.setRoot(cfg.root);

export default obs;
