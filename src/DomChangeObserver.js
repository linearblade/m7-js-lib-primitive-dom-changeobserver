/*
 * Copyright (c) 2025 m7.org
 * License: MTL-10 (see LICENSE.md)
 */
/**
 * DomChangeObserver
 *
 * A low-level DOM observation primitive.
 *
 * CONTRACT / INTENT
 * -----------------
 * Reports DOM changes filtered by selector(s). No side effects beyond reporting.
 *
 * - Observes a DOM root via MutationObserver and reports changes in batches.
 * - Supports a global handler (`onChange`) and optional per-selector handlers (`onEvent`).
 * - Emits selector-relevant lifecycle buckets:
 *
 *   added:
 *     Nodes newly present in the observed subtree AND matching a selector
 *     at collection time (during mutation processing).
 *     Note: matches are NOT re-evaluated at delivery time.
 *
 *   removed:
 *     Nodes removed from the observed subtree AND matching a selector
 *     at removal time (best-effort; relies on snapshots captured at mutation time).
 *
 *   changed:
 *     Nodes that existed in the subtree and, due to attribute changes,
 *     transitioned from NOT matching → matching a selector.
 *
 *   changeAway:
 *     Nodes that existed in the subtree and, due to attribute changes,
 *     transitioned from matching → NOT matching a selector.
 *
 * SEMANTICS
 * ---------
 * - `changed` and `changeAway` are selector-membership transitions, not a guarantee
 *   that all attribute changes are reported.
 * - Only mutations that cause selector match status to flip are surfaced.
 * - If attribute observation is disabled, `changed` / `changeAway` remain empty.
 * - CharacterData mutations (text node changes) are not observed or supported.
 *
 * GLOBAL VS SELECTOR EVENTS
 * ------------------------
 * - The global `onChange` handler (if provided) fires for every delivered batch.
 * - Per-selector `onEvent` handlers (if configured) fire in addition to `onChange`
 *   and receive selector-scoped views of the same lifecycle buckets.
 *
 * PERFORMANCE NOTE — SUBTREE MATCHING (READ)
 * -----------------------------------------
 * When subtree matching is enabled, each added/removed node may be scanned
 * using `querySelectorAll()` for every enabled selector that requests subtree
 * matches. In the worst case this is:
 *
 *   O(number of selectors × number of descendants)
 *
 * This can become expensive for large subtrees or many selectors.
 *
 * When subtree matching is disabled, only the mutation target itself is tested
 * against selectors; matching descendants are ignored and will only be reported
 * if they are the direct subject of a later mutation.
 *
 * Consumers should enable subtree matching only when semantically required and
 * scope selectors and roots as narrowly as possible.
 *
 * CAPABILITIES
 * ------------
 * Does:
 *  - Observe DOM mutations
 *  - Match elements against selectors
 *  - Batch and report structural and attribute-driven changes
 *  - Reconfigure its underlying MutationObserver when selector registry changes
 *    require different observation options (e.g. attributes / attributeFilter)
 *
 * Does NOT:
 *  - Attach jobs
 *  - Run jobs
 *  - Mutate application state
 *  - Schedule work beyond batching delivery
 *
 * This class reports facts; it does not decide behavior.
 */

//best effort to make this compatible with most things.
function resolveHost(explicit) {
    if (explicit) return explicit;
    if (typeof globalThis !== "undefined") return globalThis;
    if (typeof window !== "undefined") return window;
    if (typeof global !== "undefined") return global;
    return undefined;
}


export default class DomChangeObserver {
    /**
     * @constructor
     * @param {DomChangeObserverOptions} [opts]
     *
     * @param {Element|Document|DocumentFragment|null} [opts.root=null]
     *   Explicit root node to observe. If omitted/null and a browser-like `document`
     *   is available, the observer resolves a default root (typically `document.body`,
     *   falling back to `document.documentElement` or `document`).
     *
     *   Root is resolved once at construction and stored as an internal single source
     *   of truth (`this._root`). Mutating `opts.root` after construction has no effect.
     *   To change the observation root after creation, use `setRoot(...)`.
     *
     * @param {SelectorInput} [opts.selectors=[]]
     *   Initial selector(s) to register.
     *
     *   Accepts either:
     *   - selector strings (legacy / shorthand)
     *   - selector specs ({@link SelectorSpec}) to lock per-selector options
     *
     * @param {boolean} [opts.includeSubtreeMatches=false]
     *   Global default/fallback: when a node is added or removed, also match descendants.
     *   This can be overridden per selector via `SelectorSpec.includeSubtreeMatches`.
     *
     *   HERE BE DRAGONS — Performance warning
     *   Enabling subtree matching causes the observer to scan the added/removed subtree
     *   using `querySelectorAll()` for each enabled selector that requests subtree
     *   matches. Worst-case cost is proportional to:
     *
     *     O(number of descendants × number of enabled selectors)
     *
     *   Prefer leaving this disabled unless subtree semantics are explicitly required.
     *
     * @param {boolean} [opts.observeAttributes=false]
     *   Global default/fallback: whether selectors should observe attribute mutations.
     *   Can be overridden per selector via `SelectorSpec.observeAttributes`.
     *
     * @param {AttributeFilterInput} [opts.attributeFilter=null]
     *   Global default/fallback attribute filter.
     *
     *   IMPORTANT:
     *   MutationObserver's `attributeFilter` is GLOBAL (not per selector).
     *   This observer computes an effective attributeFilter as the UNION of:
     *     - this global fallback, and
     *     - all enabled selectors' per-selector attributeFilter lists.
     *
     * @param {number} [opts.debounceMs=0]
     *   Batch delivery debounce in milliseconds.
     *
     * @param {(batch: DomChangeBatch) => void} [opts.onChange]
     *   Optional global batch callback. Fires for every delivered batch.
     *   Per-selector `onEvent` handlers (if configured) fire in addition to this callback.
     */

    /**
     * Global onChange handler.
     *
     * - Fires for every delivered batch (if provided).
     * - Receives the full, aggregated batch across all selectors.
     * - Per-selector `onEvent` handlers (if configured) fire *in addition* to onChange.
     *
     * IMPORTANT:
     * If no onChange is provided, the observer still tracks internal state and statistics;
     * it simply does not emit a global event.
     *
     * @callback DomChangeObserverOnChange
     * @param {DomChangeBatch} batch
     */

    /**
     * Per-selector onEvent handler.
     *
     * - Fires only when this selector has any relevant records in the delivered batch.
     * - Receives slices of the batch *scoped to that selector*.
     * - Includes:
     *     - Structural transitions: added / removed
     *     - Selector-membership transitions: changed / changeAway
     *
     * NOTE:
     * - `changed` / `changeAway` are membership transitions, not raw attribute changes.
     * - Records may include multiple selectors; the event is scoped by `evt.selector`.
     *
     * @callback DomChangeObserverOnEvent
     * @param {SelectorEvent} evt
     */
    
    constructor(opts = {}) {
	this.opts = {
            root: null,
            host: null,
            selectors: [],
            includeSubtreeMatches: false,
            observeAttributes: false,
            attributeFilter: null,
            debounceMs: 0,
            onChange: null,
            ...opts,
	};

	// Resolve root ONCE (SOT), then freeze the reference.
	const host = this.opts.host || resolveHost();
	const resolvedRoot = this._resolveDomRoot(this.opts.root, host) || null;

	Object.defineProperty(this, "_root", {
            value: resolvedRoot,
            writable: false,
            configurable: true,
            enumerable: false,
	});

	Object.defineProperty(this, "_host", {
	    value: host,
	    writable: false,
	    configurable: true,
	    enumerable: false,
	});

	this._MO = this._getMO();
	
	// Init registries
	this._selectorTable = new Map();
	this._selectors = [];
	this._lastMatched = new WeakMap();
	this._observer = null;
	this._running = false;
	this._observeSig = "";
	this._pending = { added:new Map(), removed:new Map(), changed:new Map(), changeAway:new Map() };
	this._timer = null;

	// Apply non-root configuration through the canonical path (no duplication).
	// Avoid passing `root` (configure forbids it).
	const { root, ...cfg } = this.opts;
	this.configure(cfg);
    }

    _getMO() {
	const h = this._host || resolveHost();
	return (h && h.MutationObserver) ? h.MutationObserver :
            (typeof MutationObserver !== "undefined" ? MutationObserver : null);
    }
    _resolveDomRoot(explicitRoot, host) {
	if (explicitRoot) return explicitRoot;

	const h = host || resolveHost();
	const doc = h && h.document;
	if (!doc) return undefined;

	const candidate = doc.body || doc.documentElement || doc;
	return candidate || undefined;
    }
    // ---------------------------
    // Public API
    // ---------------------------

    /**
     * Configure global (non-root) observer behavior.
     *
     * This updates instance-level defaults and/or selector registry without
     * changing the observation root.
     *
     * IMPORTANT:
     *  - The observation root is resolved once at construction time and stored
     *    internally as a single source of truth (`this._root`).
     *  - `root` cannot be configured here. To change the observation root after
     *    creation, use {@link DomChangeObserver#setRoot}.
     *
     * Supported configuration keys (all optional):
     *  - host                 : host object used for root resolution (informational after construction)
     *  - selectors            : replaces the selector registry (forwarded to setSelectors)
     *  - includeSubtreeMatches: global default/fallback for selector subtree matching
     *  - observeAttributes    : global default/fallback for attribute observation
     *  - attributeFilter      : global default/fallback attribute filter
     *  - debounceMs           : batch delivery debounce (ms)
     *  - onChange             : global batch callback
     *
     * Calling this method while the observer is running may trigger a safe
     * re-observation if the effective MutationObserver options change.
     *
     * @param {Partial<DomChangeObserverOptions>} cfg
     * @returns {this}
     * @throws {Error} If `cfg.root` is provided (root must be set via setRoot()).
     */
    configure(cfg = {}) {
	if (!cfg || typeof cfg !== "object") return this;

	// Explicitly forbid root here — root has its own lifecycle and API.
	if (Object.prototype.hasOwnProperty.call(cfg, "root")) {
            throw new Error(
		"DomChangeObserver.configure(): root cannot be configured here; use setRoot()."
            );
	}

	// host: retained for completeness, but does not retroactively affect _root
	if (Object.prototype.hasOwnProperty.call(cfg, "host")) {
            this.opts.host = cfg.host ?? null;
	}

	// Global defaults (non-root)
	if (Object.prototype.hasOwnProperty.call(cfg, "includeSubtreeMatches")) {
            this.opts.includeSubtreeMatches = !!cfg.includeSubtreeMatches;
	}

	if (Object.prototype.hasOwnProperty.call(cfg, "observeAttributes")) {
            this.opts.observeAttributes = !!cfg.observeAttributes;
	}

	if (Object.prototype.hasOwnProperty.call(cfg, "attributeFilter")) {
            this.opts.attributeFilter = this._coerceAttributeFilter(cfg.attributeFilter);
	}

	if (Object.prototype.hasOwnProperty.call(cfg, "debounceMs")) {
            const n = cfg.debounceMs;
            const v = (n === null || n === undefined) ? 0 : Number(n);
            this.opts.debounceMs = (Number.isFinite(v) && v >= 0) ? v : 0;
	}

	if (Object.prototype.hasOwnProperty.call(cfg, "onChange")) {
            const fn = cfg.onChange;
            this.opts.onChange = (typeof fn === "function" || fn === null) ? fn : null;
	}

	// selectors: replace registry via the canonical path
	if (Object.prototype.hasOwnProperty.call(cfg, "selectors")) {
            this.setSelectors(cfg.selectors ?? []);
	}

	return this;
    }
    /**
     * Set a new observation root (explicit operation).
     *
     * Replaces the current root with `newRoot` and updates the observer’s internal
     * single source of truth. If the observer is currently running, it will detach
     * from the previous root and re-attach to the new root using the current
     * effective MutationObserver options.
     *
     * The root reference is frozen per assignment; subsequent calls must explicitly
     * invoke `setRoot()` to change it again.
     *
     * @param {Element|Document|DocumentFragment} newRoot
     *   The DOM node to observe.
     *
     * @param {*} [host]
     *   Optional host/realm associated with the new root (e.g. a jsdom `window`).
     *   When provided, this host is used to resolve a compatible MutationObserver
     *   constructor for the new root.
     *
     * @returns {boolean}
     *   `true` if the root changed; `false` if `newRoot` is identical to the current root.
     *
     * @throws {Error}
     *   If `newRoot` is not a valid DOM Element, Document, or DocumentFragment.
     *   If the observer is running but its internal observer instance is missing
     *   (invariant violation).
     */
    setRoot(newRoot, host = null) {
	// Resolve host (same idea as constructor)
	const resolvedHost = host || this.opts.host || resolveHost();

	// Validate root type
	if (!newRoot || typeof newRoot !== "object" || ![1, 9, 11].includes(newRoot.nodeType)) {
            throw new Error(
		"DomChangeObserver.setRoot(): invalid root. " +
		    "Provide a DOM Element/Document/DocumentFragment."
            );
	}

	// No-op if identical
	if (this._root === newRoot) return false;

	// Persist host as SOT for this realm (used for MutationObserver resolution)
	Object.defineProperty(this, "_host", {
            value: resolvedHost,
            writable: false,
            configurable: true,
            enumerable: false,
	});

	// Cache same-realm MutationObserver ctor (aligns with constructor)
	this._MO = this._getMO();

	// Redefine frozen root ref
	Object.defineProperty(this, "_root", {
            value: newRoot,
            writable: false,
            configurable: true,
            enumerable: false,
	});

	// If not running, we're done (next start() will observe this root)
	if (!this._running) return true;

	// Running: re-attach observer to the new root
	if (!this._observer) {
            throw new Error("DomChangeObserver: invariant violation: _running=true but _observer is null.");
	}

	// Disconnect and re-observe with current effective options
	this._observer.disconnect();

	const opts = this._buildObserveOptions();
	this._observeSig = this._observeSignature(opts);

	this._observer.observe(this._root, opts);
	this._lastMatched = new WeakMap();
	return true;
    }
    /**
     * Replace all selectors with a new set.
     *
     * This is a hard reset of selector registry state:
     *  - existing selector entries and per-selector stats are discarded
     *  - any pending (undelivered) records are cleared
     *  - attribute match history is reset (changeAway baseline is rebuilt lazily)
     *
     * If the observer is currently running, it may re-observe if the effective
     * MutationObserver options change (e.g. attributes / attributeFilter union).
     *
     * @param {SelectorInput} selectors
     */
    setSelectors(selectors) {
	// Hard reset semantics
	this._clearPending();
	this._resetLastMatched();

	this._setSelectorTable(selectors);
	this._maybeReobserve();
    }
    /**
     * Check whether a selector exists in the registry
     * (enabled or disabled).
     *
     * @param {string} selector
     * @returns {boolean}
     */
    hasSelector(sel) {
        const s = this._coerceSelector(sel);
        if (!s) return false;
        return this._selectorTable.has(s);
    }

    /**
     * Retrieve selector state and optional stats.
     *
     * @param {string} selector
     * @param {Object} [opts]
     * @param {boolean} [opts.stats=false]
     *   Whether to include selector statistics.
     *
     * @returns {{selector: string, enabled: boolean, stats?: SelectorStats}|null}
     */
    getSelector(sel, opts = {}) {
        const s = this._coerceSelector(sel);
        if (!s) return null;
        const entry = this._selectorTable.get(s);
        if (!entry) return null;
        const out = { selector: entry.selector, enabled: !!entry.enabled };
        if (opts.stats) out.stats = { ...entry.stats };
        return out;
    }

    /**
     * Alias of {@link DomChangeObserver#addSelector}.
     *
     * @param {string} selector
     * @param {(evt: SelectorEvent) => void} [onEvent]
     * @returns {boolean} True if added.
     */

    add(selector, onEvent) {
	return this.addSelector(selector, { onEvent });
    }

    
    /**
     * Alias of {@link DomChangeObserver#removeSelector}.
     *
     * @param {string} selector
     * @returns {boolean} True if removed.
     */
    remove(selector) {
	return this.removeSelector(selector);
    }
    

    /**
     * Register a selector.
     *
     * Per-selector options are "locked" to the selector entry and used for:
     *  - whether attribute changes should be tracked for this selector
     *  - which attributes should be considered (per-selector filter)
     *  - whether subtree matching should be applied for added/removed nodes
     *
     * If the observer is currently running and the effective MutationObserver
     * options change (e.g. attributes / attributeFilter union), it will
     * automatically re-observe with updated options.
     *
     * @param {string} selector
     * @param {SelectorAddOptions} [opts]
     * @returns {boolean} True if added.
     */
    addSelector(sel, opts = {}) {
	const s = this._coerceSelector(sel);
	if (!s) return false;
	if (this._selectorTable.has(s)) return false;

	const entry = this._makeSelectorEntry(s, { selector: s, ...(opts || {}) });

	this._selectorTable.set(s, entry);
	this._rebuildSelectorCache();
	this._maybeReobserve();
	return true;
    }
    /**
     * Remove a selector and scrub pending state.
     *
     * @param {string} selector
     * @returns {boolean}
     */
    removeSelector(sel) {
        const s = this._coerceSelector(sel);
        if (!s) return false;
        if (!this._selectorTable.delete(s)) return false;
        this._rebuildSelectorCache();
        this._scrubSelectorFromPending(s);
        this._resetLastMatched();
	this._maybeReobserve();
        return true;
    }

    /**
     * Disable a selector (partial pause).
     *
     * If the observer is currently running, it may re-observe if this change
     * affects effective observation options (attributes / attributeFilter union).
     *
     * @param {string} selector
     * @param {Object} [opts]
     * @param {boolean} [opts.dropPending=false]
     *   Whether to drop pending records for this selector.
     * @returns {boolean} True if state changed.
     */
    pauseSelector(sel, opts = {}) {
	const changed = this.setSelectorEnabled(sel, false);
	if (!changed) return false;

	if (opts && opts.dropPending) {
	    const s = this._coerceSelector(sel);
	    if (s) this._scrubSelectorFromPending(s);
	}
	return true;
    }
    /**
     * Enable a selector.
     *
     * If the observer is currently running, it may re-observe if this change
     * affects effective observation options.
     *
     * @param {string} selector
     * @returns {boolean} True if state changed.
     */
    resumeSelector(sel) {
        return this.setSelectorEnabled(sel, true);
    }

    /**
     * Enable or disable a selector.
     *
     * If the observer is currently running, it may re-observe if this change
     * affects effective observation options.
     *
     * @param {string} selector
     * @param {boolean} on
     * @returns {boolean} True if state changed.
     */
    setSelectorEnabled(sel, on = true) {
        const s = this._coerceSelector(sel);
        if (!s) return false;
        const entry = this._selectorTable.get(s);
        if (!entry) return false;
        const next = !!on;
        if (!!entry.enabled === next) return false;
        entry.enabled = next;
        this._rebuildSelectorCache();
	this._maybeReobserve();
        return true;
    }

    
    /**
     * Returns enabled selectors.
     *
     * @returns {string[]}
     */
    getSelectors() {
	return [...this._selectors];
    }

    /**
     * List all selectors and their state.
     *
     * @param {Object} [opts]
     * @param {boolean} [opts.stats=false]
     * @returns {Array<{selector: string, enabled: boolean, stats?: SelectorStats}>}
     */
    listSelectors(opts = {}) {
	const includeStats = !!opts.stats;
	const out = [];
	for (const entry of this._selectorTable.values()) {
	    const row = { selector: entry.selector, enabled: !!entry.enabled };
	    if (includeStats) row.stats = { ...entry.stats };
	    out.push(row);
	}
	return out;
    }

    /**
     * Start observing the DOM.
     *
     * Initializes and attaches a MutationObserver to the resolved root
     * (`this._root`) using the current effective observation options derived
     * from enabled selectors and global defaults.
     *
     * Behavior:
     *  - If already running, this is a no-op and returns true.
     *  - Validates runtime requirements (DOM root, MutationObserver availability).
     *  - Throws if required capabilities are missing or attachment fails.
     *
     * Notes:
     *  - The observation root is resolved once at construction time.
     *    Mutating `opts.root` after construction has no effect.
     *  - To change the observation root after creation, use {@link setRoot}.
     *
     * @returns {boolean} True if observation is active or was already running.
     * @throws {Error} If no valid DOM root is available.
     * @throws {Error} If MutationObserver is not available or attachment fails.
     */
    start() {
	if (this._running) return true;
	this._startValidation();

	const root = this._root;

	
	this._observer = new this._MO( (mutations) => this._onMutations(mutations) );
	//this._observer = new MutationObserver((mutations) => this._onMutations(mutations));

	const opts = this._buildObserveOptions();
	this._observeSig = this._observeSignature(opts);

	this._observer.observe(root, opts);

	this._running = true;
	return true;
    }

    /**
     * Ensure we are ready to start observing.
     * Throws if required runtime capabilities are missing.
     * @private
     */
    _startValidation(){
	const root = this._root;
	
	// Barf and die horribly here. You really need a proper root (literally and figuratively). Really. Lack thereof is no way to go about life.
	if (!root || typeof root !== "object" || ![1, 9, 11].includes(root.nodeType)) {
	    throw new Error(
		"DomChangeObserver.start(): no DOM root available. " +
		    "Provide opts.root (a DOM Element/Document/DocumentFragment) in non-browser environments."
	    );
	}


	// if MutationObserver isn't available, also die harder. b/c whats the point if you dont have a pod of mutalisks?
	const MO = this._MO || this._getMO();
	if (!MO) {
            throw new Error(
		"DomChangeObserver.start(): MutationObserver is not available in this environment."
            );
	}
    }


    /**
     * Stop observing and reset runtime observation state.
     *
     * Disconnects the underlying MutationObserver and clears transient state
     * associated with the current observation session.
     *
     * Effects:
     *  - disconnects the underlying MutationObserver
     *  - cancels any scheduled delivery timer
     *  - clears any pending (undelivered) records
     *  - resets attribute match history (changeAway baseline)
     *  - marks the observer as not running
     *
     * Does NOT:
     *  - remove selectors or change selector enabled/disabled state
     *  - reset per-selector statistics
     *
     * @throws {Error} If disconnecting the underlying MutationObserver fails.
     */
    stop() {
	if (this._observer) {
            try { this._observer.disconnect(); }
            catch (e) {
		throw this._makeError("DomChangeObserver.stop(): failed to disconnect MutationObserver.", { cause: e });
            }
	}

	this._observer = null;
	this._running = false;
	this._observeSig = "";

	if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
	}

	this._clearPending();
	this._lastMatched = new WeakMap();
    }
    
    
    /**
     * Pause observing without clearing pending batches.
     *
     * Effects:
     *  - disconnects the underlying MutationObserver
     *  - cancels any scheduled delivery timer
     *  - preserves pending records for later {@link DomChangeObserver#flush} / {@link DomChangeObserver#takePending}
     */
    pause() {
	if (!this._running) return true;

	if (this._observer) {
            try { this._observer.disconnect(); }
            catch (e) {
		throw this._makeError("DomChangeObserver.pause(): failed to disconnect MutationObserver.", { cause: e });
            }
	}

	this._observer = null;
	this._running = false;
	this._observeSig = "";

	if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
	}

	return true;
    }
    /**
     * Resume observing (alias of start).
     * @returns {boolean}
     */
    resume() {
	return this.start();
    }
    /**
     * Returns lifecycle state.
     * @returns {"running"|"paused"}
     */

    state() {
	return this._running ? "running" : "paused";
    }


    /**
     * Returns whether the observer is currently running.
     * @returns {boolean}
     */
    isRunning() {
	return this._running;
    }

    /**
     * Force immediate delivery of pending changes.
     *
     * @returns {DomChangeBatch|null}
     */
    flush() {
	if (this._timer) {
	    clearTimeout(this._timer);
	    this._timer = null;
	}
	return this._deliverIfPending();
    }


    /**
     * Pull-style consumption.
     *
     * Returns and clears any pending records without invoking callbacks.
     *
     * @returns {DomChangeBatch|null}
     */
    takePending() {
	const batch = this._buildBatchFromPending();
	if (!batch) return null;
	this._clearPending();
	return batch;
    }

    // ---------------------------
    // Private
    // ---------------------------
    /**
     * Build effective MutationObserver options.
     *
     * NOTE: MutationObserver attributeFilter is GLOBAL.
     * We compute an effective config from:
     *  - global defaults (this.opts.*)
     *  - enabled selectors that opt-in to attribute observation / filtering
     *
     * If any enabled selector opts into attribute observation, we must observe attributes.
     * If any filters exist (global or per-selector), we use the UNION as the observer-level attributeFilter.
     *
     * @returns {MutationObserverInit}
     */

    _buildObserveOptions() {
	// NOTE: MutationObserver attributeFilter is GLOBAL.
	// We compute an effective config from:
	//  - global defaults (this.opts.*)
	//  - enabled selectors that opt-in to attribute observation / filtering
	//
	// If any enabled selector opts into attribute observation, we must observe attributes.
	// If any filters exist (global or per-selector), we use the UNION as observer-level attributeFilter.
	const o = {
	    childList: true,
	    subtree: true,
	};

	let observeAttributes = !!this.opts.observeAttributes;

	const union = new Set();
	const addToUnion = (arr) => {
	    if (!Array.isArray(arr)) return;
	    for (const v of arr) {
		if (v === null || v === undefined) continue;
		const s = String(v).trim();
		if (!s) continue;
		union.add(s);
	    }
	};

	addToUnion(this._coerceAttributeFilter(this.opts.attributeFilter));

	for (const sel of this._selectors) {
	    const entry = this._selectorTable.get(sel);
	    if (!entry || !entry.enabled) continue;
	    if (entry.opts && entry.opts.observeAttributes) observeAttributes = true;
	    addToUnion(entry.opts ? entry.opts.attributeFilter : null);
	}

	if (observeAttributes) {
	    o.attributes = true;
	    if (union.size) {
		// Stable ordering for signature comparisons.
		o.attributeFilter = Array.from(union).sort();
	    }
	}

	return o;
    }
    /**
     * Create a stable signature for effective observe options.
     * Only includes keys we set / care about.
     *
     * @param {MutationObserverInit} observeOptions
     * @returns {string}
     */

    _observeSignature(observeOptions) {
	// Create a stable signature for effective observe options.
	// Only includes keys we set / care about.
	const attrs = observeOptions && observeOptions.attributes ? 1 : 0;
	const filter = (observeOptions && Array.isArray(observeOptions.attributeFilter))
	      ? observeOptions.attributeFilter.join("\u0001")
	      : "";
	return `cl:1|st:1|at:${attrs}|af:${filter}`;
    }

    /**
     * If currently running, detect whether the effective MutationObserver
     * options changed (e.g. attributeFilter union) and re-observe.
     *
     * - Keeps pending batches intact
     * - Resets attribute-match history (lastMatched), because semantics changed
     *
     * Throws if re-observation fails. On failure, the observer is no longer running.
     *
     * @returns {boolean} True if re-observed; false if no change was required.
     */
    _maybeReobserve() {
	// If running, and the effective observe options changed (e.g. attributeFilter union),
	// safely re-observe with the new options.
	if (!this._running) return false;

	const root = this._root;

	// Invariant: if we're running, we must have an observer.
	if (!this._observer) {
            throw new Error("DomChangeObserver._maybeReobserve(): invariant violation: _running=true but _observer is null.");
	}

	const nextOpts = this._buildObserveOptions();
	const nextSig = this._observeSignature(nextOpts);

	// No change; no need to reobserve.
	if (nextSig === this._observeSig) return false;

	// Reobserve: disconnect then observe with new options.
	try {
            this._observer.disconnect();
	} catch (err) {
            throw this._makeError(
		"DomChangeObserver._maybeReobserve(): failed to disconnect MutationObserver.",
		{ cause: err }
            );
	}

	try {
            this._observer.observe(root, nextOpts);
            this._observeSig = nextSig;

            // Semantics changed; reset attribute-match baseline.
            this._lastMatched = new WeakMap();

            return true;
	} catch (err) {
            // We are now disconnected and failed to reattach; do NOT stay "running".
            // Also clear the observer reference to avoid holding a dead observer.
            this._running = false;
            this._observer = null;

            throw this._makeError(
		"DomChangeObserver._maybeReobserve(): failed to observe root with updated options.",
		{ cause: err }
            );
	}
    }
    _normalizeSelectorSpecs(input) {
	if (!input) return [];
	const arr = Array.isArray(input) ? input : [input];

	const out = [];
	const seen = new Set();

	for (const item of arr) {
	    let spec = null;

	    if (typeof item === "string" || typeof item === "number") {
		const selector = this._coerceSelector(item);
		if (!selector) continue;
		spec = { selector };
	    } else if (item && typeof item === "object") {
		const selector = this._coerceSelector(item.selector ?? item.sel ?? item.s);
		if (!selector) continue;
		spec = { ...item, selector };
	    } else {
		continue;
	    }

	    // Deduplicate by selector; last one wins.
	    if (seen.has(spec.selector)) {
		for (let i = out.length - 1; i >= 0; i--) {
		    if (out[i].selector === spec.selector) { out[i] = spec; break; }
		}
		continue;
	    }
	    seen.add(spec.selector);
	    out.push(spec);
	}

	return out;
    }

    _coerceAttributeFilter(filter) {
	if (filter === null || filter === undefined) return null;

	let list = [];
	if (Array.isArray(filter)) {
	    list = filter;
	} else if (typeof filter === "string") {
	    // Support space/comma separated strings.
	    list = filter.split(/[\s,]+/);
	} else {
	    list = [String(filter)];
	}

	const cleaned = [];
	const seen = new Set();
	for (const a of list) {
	    if (a === null || a === undefined) continue;
	    const s = String(a).trim();
	    if (!s) continue;
	    if (seen.has(s)) continue;
	    seen.add(s);
	    cleaned.push(s);
	}

	return cleaned.length ? cleaned : null;
    }

    
    _coerceSelector(sel) {
        if (sel === null || sel === undefined) return "";
        const s = String(sel).trim();
        return s;
    }

    /**
     * Create a selector registry entry.
     *
     * Selector options default to global fallbacks when unspecified.
     *
     * @param {string} sel
     * @param {SelectorSpec} [spec]
     * @returns {SelectorEntry}
     */

    _makeSelectorEntry(sel, spec = {}) {
	const observeAttributes =
	      (spec.observeAttributes !== undefined) ? !!spec.observeAttributes : !!this.opts.observeAttributes;

	const includeSubtreeMatches =
	      (spec.includeSubtreeMatches !== undefined) ? !!spec.includeSubtreeMatches : !!this.opts.includeSubtreeMatches;

	// Per-selector attribute filter fallback:
	// - If provided on selector, use it
	// - Else fall back to global opts.attributeFilter (if any)
	const attributeFilter = this._coerceAttributeFilter(
	    (spec.attributeFilter !== undefined) ? spec.attributeFilter : this.opts.attributeFilter
	);

	return {
	    selector: sel,
	    enabled: (spec.enabled !== undefined) ? !!spec.enabled : true,
	    onEvent: (typeof spec.onEvent === "function") ? spec.onEvent : null,
	    opts: {
		observeAttributes,
		includeSubtreeMatches,
		attributeFilter, // array|null
	    },
	    stats: {
		events: 0,
		matched: 0,
		added: 0,
		removed: 0,
		changed: 0,
		changeAway: 0,
		lastAt: 0,
	    },
	};
    }

    
    
    _setSelectorTable(selectors) {
	const specs = this._normalizeSelectorSpecs(selectors);
	this._selectorTable.clear();
	for (const spec of specs) {
	    const sel = spec.selector;
	    this._selectorTable.set(sel, this._makeSelectorEntry(sel, spec));
	}
	this._rebuildSelectorCache();
    }

    _rebuildSelectorCache() {
	this._selectors = [];
	for (const entry of this._selectorTable.values()) {
	    if (entry && entry.enabled) this._selectors.push(entry.selector);
	}
    }

    
    _scrubSelectorFromPending(sel) {
        const scrubMap = (map) => {
            for (const [el, set] of map.entries()) {
                if (set && set.delete(sel)) {
                    if (set.size === 0) map.delete(el);
                }
            }
        };
        scrubMap(this._pending.added);
        scrubMap(this._pending.removed);
        scrubMap(this._pending.changed);
        scrubMap(this._pending.changeAway);
    }

    _resetLastMatched() {
        // WeakMap isn't iterable. Minimal safe approach:
        // We only scrub on remove by resetting the entire lastMatched map.
        // This is acceptable for a primitive and avoids leaking stale selector references.
        // (Next attribute mutation will rebuild accurate matches.)
        this._lastMatched = new WeakMap();
    }

    _bumpSelectorStat(sel, kind) {
	const entry = this._selectorTable.get(sel);
	if (!entry) return;
	const s = entry.stats;
	if (!s) return;
	s.matched++;
	s.events++;
	if (kind && Object.prototype.hasOwnProperty.call(s, kind)) s[kind]++;
	s.lastAt = Date.now();
    }
    

    _onMutations(mutations) {
	if (!mutations || !mutations.length) return;
	if (!this._selectors.length) return; // nothing to match

	for (const m of mutations) {
	    if (m.type === "childList") {
		for (const n of m.addedNodes || []) this._collectFromNode("added", n);
		for (const n of m.removedNodes || []) this._collectFromNode("removed", n);
	    } else if (m.type === "attributes") {
		this._collectAttributeChange(m.target, m.attributeName);
	    }
	}

	this._scheduleDeliver();
    }

    _collectFromNode(kind, node) {
	if (!node || node.nodeType !== 1) return;

	// Match the node itself against all enabled selectors.
	this._matchElement(kind, node);

	// Optionally match descendants per selector.
	if (!node.querySelectorAll) return;

	for (const sel of this._selectors) {
            const entry = this._selectorTable.get(sel);
            if (!entry || !entry.enabled) continue;

            const include = entry.opts.includeSubtreeMatches;
            if (!include) continue;

            let list;
            try { list = node.querySelectorAll(sel); } catch { continue; }
            for (const el of list) this._record(kind, el, sel);
	}
    }
    /**
     * Collect attribute-derived selector changes.
     *
     * Only selectors that opted into attribute observation participate.
     * Per-selector attributeFilter is applied here (in addition to the
     * global MutationObserver attributeFilter union).
     *
     * Note: selector option `attributeFilter` is normalized to a string[]
     * for matching (string input is treated as a single attribute name).
     *
     * @param {Element} target
     * @param {string|null} attributeName
     */
    _collectAttributeChange(target, attributeName) {
	const el = target;
	if (!el || el.nodeType !== 1) return;

	const attr = (attributeName === null || attributeName === undefined) ? "" : String(attributeName);

	const prev = this._lastMatched.get(el); // Set<string> | undefined

	// Compute current matches against enabled selectors that observe attributes
	// (and match this selector's attributeFilter).
	const matchedNow = [];
	for (const sel of this._selectors) {
            const entry = this._selectorTable.get(sel);
            if (!entry || !entry.enabled) continue;
            if (!entry.opts || !entry.opts.observeAttributes) continue;

            const filter = entry.opts.attributeFilter; // string[] | null (normalized at registration)

            // If a selector has an attributeFilter and the attribute name is unknown/empty,
            // the selector does not match that mutation.
            if (filter && !filter.includes(attr)) continue;

            if (this._matches(el, sel)) matchedNow.push(sel);
	}
	const nowSet = new Set(matchedNow);

	// 1) changed: selectors that match *now*
	//leaving this means re matching. so consider a flag in later version
	//for (const sel of matchedNow) {
        //this._record("changed", el, sel);
	//}
	for (const sel of matchedNow) {
	    if (!prev || !prev.has(sel)) this._record("changed", el, sel);
	}
	

	// 2) changeAway: selectors that matched previously but do not match now
	if (prev && prev.size) {
            for (const sel of prev) {
		if (!nowSet.has(sel)) this._recordChangeAway(el, sel);
            }
	}

	// 3) Update last-known matches (only for attribute-observing selectors)
	if (matchedNow.length) {
            this._lastMatched.set(el, nowSet);
	} else {
            this._lastMatched.delete(el);
	}
    }

    
    _recordChangeAway(el, sel) {
	let set = this._pending.changeAway.get(el);
	if (!set) {
	    set = new Set();
	    this._pending.changeAway.set(el, set);
	}
	if (sel) {
	    set.add(sel);
	    this._bumpSelectorStat(sel, "changeAway");
	}
    }

    _matchElement(kind, el) {
	for (const sel of this._selectors) {
	    if (this._matches(el, sel)) this._record(kind, el, sel);
	}
    }

    _matches(el, sel) {
	try { return !!el.matches && el.matches(sel); } catch { return false; }
    }



    _record(kind, el, sel) {
	//extra types are not necessary at moment, but I'll try merge in future version
	const map =
	      kind === "added" ? this._pending.added :
	      kind === "removed" ? this._pending.removed :
	      kind === "changed" ? this._pending.changed :
	      kind === "changeAway" ? this._pending.changeAway :
	      null;
	if (!map) return;
	//const map =
	//kind === "added" ? this._pending.added :
	//kind === "removed" ? this._pending.removed :
	//this._pending.changed;

	let set = map.get(el);
	if (!set) {
            set = new Set();
            map.set(el, set);
	}
	set.add(sel);
	this._bumpSelectorStat(sel, kind);

	// Attribute-driven "changeAway" baseline:
	// - update on "added" and "changed"
	// - clear on "removed" to avoid leaking history across removal/reinsert cycles
	const entry = this._selectorTable.get(sel);
	if (entry && entry.enabled && entry.opts && entry.opts.observeAttributes) {
            if (kind === "removed") {
		this._lastMatched.delete(el);
            } else { // "added" or "changed"
		let last = this._lastMatched.get(el);
		if (!last) {
                    last = new Set();
                    this._lastMatched.set(el, last);
		}
		last.add(sel);
            }
	}
    }
    _scheduleDeliver() {
	if (this._timer) return;

	const ms = Number.isFinite(this.opts.debounceMs) ? this.opts.debounceMs : 0;
	this._timer = setTimeout(() => {
	    this._timer = null;
	    this._deliverIfPending();
	}, ms > 0 ? ms : 0);
    }
    _recordsForSelector(records, sel) {
	if (!records || !records.length) return [];
	const out = [];
	for (const r of records) {
	    // r.selectors is always an array in your build step
	    if (r && Array.isArray(r.selectors) && r.selectors.includes(sel)) out.push(r);
	}
	return out;
    }

    

    _deliverIfPending() {
	const batch = this._buildBatchFromPending();
	if (!batch) return null;

	// Clear before calling user code to avoid re-entrancy weirdness
	this._clearPending();

	// 1) Global onChange (if present)
	const cb = this.opts.onChange;
	if (typeof cb === "function") {
	    try { cb(batch); } catch {}
	}

	// 2) Per-selector onEvent (conditional)
	// Originally structural-only (added/removed) to avoid noisy attribute churn.
	// Now includes changed/changeAway for selectors that opt into observeAttributes,
	// because these represent selector-relevant lifecycle transitions.
	// changed: membership flip (non-match -> match) caused by non-structural mutations (attrs/charData)
	// changeAway: membership flip (match -> non-match) caused by non-structural mutations (attrs/charData)
	for (const entry of this._selectorTable.values()) {
	    if (!entry || !entry.enabled) continue;
	    const fn = entry.onEvent;
	    if (typeof fn !== "function") continue;

	    const sel = entry.selector;

	    const added = this._recordsForSelector(batch.added, sel);
	    const removed = this._recordsForSelector(batch.removed, sel);
	    const changed = this._recordsForSelector(batch.changed, sel);
	    const changeAway = this._recordsForSelector(batch.changeAway, sel);

	    // Fire only if this selector has any relevant records
	    if (!added.length && !removed.length && !changed.length && !changeAway.length) continue;

	    const evt = {
		at: Date.now(),
		selector: sel,

		// selector-scoped slices
		added,
		removed,
		changed,
		changeAway,

		// context
		batchAt: batch.at,
		enabledSelectors: batch.selectors,
	    };

	    try { fn(evt); } catch {}
	}
	return batch;
    }

    _buildBatchFromPending() {
	const hasAny =
	      this._pending.added.size ||
	      this._pending.removed.size ||
	      this._pending.changed.size ||
	      this._pending.changeAway.size;

	if (!hasAny) return null;

	return {
	    at: Date.now(),
	    selectors: [...this._selectors],
	    added: this._mapToRecords(this._pending.added),
	    removed: this._mapToRecords(this._pending.removed),
	    changed: this._mapToRecords(this._pending.changed),
	    changeAway: this._mapToRecords(this._pending.changeAway),
	};
    }

    _mapToRecords(map) {
	const out = [];
	for (const [el, selectors] of map.entries()) {
	    out.push({ el, selectors: [...selectors] });
	}
	return out;
    }

    _clearPending() {
	this._pending.added.clear();
	this._pending.removed.clear();
	this._pending.changed.clear();
	this._pending.changeAway.clear();
    }

    _makeError(msg, opts = {}) {
	const err = new Error(msg);
	if (opts && "cause" in opts) err.cause = opts.cause;
	return err;
    }
}

/**
 * @typedef {Object} DomChangeObserverOptions
 *
 * @property {Element|Document|DocumentFragment|null} [root=null]
 *   Explicit root node to observe. If omitted/null and a browser-like `document`
 *   is available, a default root is resolved (typically `document.body`, falling
 *   back to `document.documentElement` or `document`).
 *
 *   Root is resolved once at construction and stored as an internal single source
 *   of truth (`this._root`). Mutating `opts.root` after construction has no effect.
 *   To change the observation root after creation, use {@link DomChangeObserver#setRoot}.
 *
 * @property {*} [host=null]
 *   Optional host injection point used for resolving a default root in non-browser
 *   or test environments (e.g. jsdom). When omitted, the observer uses a best-effort
 *   host resolution (globalThis/window/global).
 *
 * @property {SelectorInput} [selectors=[]]
 *   Initial selector(s) to register.
 *
 * @property {boolean} [includeSubtreeMatches=false]
 *   Global default/fallback for selector subtree matching.
 *
 * @property {boolean} [observeAttributes=false]
 *   Global default/fallback for selector attribute observation.
 *
 * @property {AttributeFilterInput} [attributeFilter=null]
 *   Global default/fallback attribute filter. Used to compute effective observer
 *   attributeFilter (as a UNION across enabled selectors).
 *
 * @property {number} [debounceMs=0]
 *   Batch delivery debounce in milliseconds.
 *
 * @property {(batch: DomChangeBatch) => void} [onChange]
 *   Optional global batch callback. Fires for every delivered batch.
 *   Per-selector events (if configured) fire in addition to this global callback.
 */

/**
 * @typedef {string|string[]|SelectorSpec|SelectorSpec[]} SelectorInput
 */

/**
 * @typedef {string|string[]|null} AttributeFilterInput
 */

/**
 * @typedef {Object} SelectorSpec
 *
 * Composite selector registration specification.
 * This is accepted in opts.selectors (constructor) and may be used
 * to "lock" selector options at registration time.
 *
 * @property {string} selector
 *   CSS selector string.
 * @property {boolean} [enabled=true]
 *   Whether this selector starts enabled.
 * @property {(evt: SelectorEvent) => void} [onEvent]
 *   Optional per-selector event handler.
 *   Fires when this selector has any records in a delivered batch.
 *   Includes structural changes (added/removed) AND selector-membership transitions
 *   caused by non-structural mutations (changed/changeAway).
 * @property {boolean} [observeAttributes]
 *   Whether attribute mutations should be tracked for this selector.
 *   Defaults to the observer's global observeAttributes.
 * @property {AttributeFilterInput} [attributeFilter]
 *   Per-selector attribute filter. Defaults to the observer's global attributeFilter.
 *   If provided, the observer will union this list into its global attributeFilter.
 * @property {boolean} [includeSubtreeMatches]
 *   Whether to match descendants of added/removed nodes for this selector.
 *   Defaults to the observer's global includeSubtreeMatches.
 */

/**
 * @typedef {Object} SelectorAddOptions
 * @property {(evt: SelectorEvent) => void} [onEvent]
 * @property {boolean} [enabled]
 * @property {boolean} [observeAttributes]
 * @property {AttributeFilterInput} [attributeFilter]
 * @property {boolean} [includeSubtreeMatches]
 */

/**
 * @typedef {Object} SelectorEntry
 * @property {string} selector
 * @property {boolean} enabled
 * @property {((evt: SelectorEvent) => void)|null} onEvent
 * @property {{observeAttributes: boolean, includeSubtreeMatches: boolean, attributeFilter: (string[]|null)}} opts
 * @property {SelectorStats} stats
 */

/**
 * @typedef {Object} DomChangeRecord
 * @property {Element} el
 *   The affected element.
 * @property {string[]} selectors
 *   Enabled selectors that matched this element at capture time.
 *   NOTE: Records may list multiple selectors even when delivered via a selector-scoped event.
 */

/**
 * @typedef {Object} DomChangeBatch
 *
 * Semantics:
 * - added/removed are driven by DOM structural mutations (childList).
 * - changed/changeAway are selector-membership transitions driven by non-structural
 *   mutations (attributes).
 * - changed/changeAway are only emitted when an element's match status flips relative
 *   to the observer's last known match state.
 *
 * @property {number} at
 *   Timestamp of batch creation.
 * @property {string[]} selectors
 *   Enabled selectors at delivery time.
 * @property {DomChangeRecord[]} added
 *   Elements newly present in the subtree that match one or more enabled selectors.
 * @property {DomChangeRecord[]} removed
 *   Elements removed from the subtree that matched one or more enabled selectors (best-effort).
 * @property {DomChangeRecord[]} changed
 *   Elements that transitioned from NOT matching → matching one or more enabled selectors.
 * @property {DomChangeRecord[]} changeAway
 *   Elements that transitioned from matching → NOT matching one or more enabled selectors.
 */

/**
 * @typedef {Object} SelectorStats
 *
 * Cumulative statistics for a selector since registration
 * or since the last hard reset (setSelectors).
 *
 * @property {number} events
 *   Total number of selector-related records observed.
 *   Includes added, removed, changed, and changeAway.
 *
 * @property {number} matched
 *   Total number of records in which this selector was involved.
 *   Includes positive matches (added/changed) and match-loss records (changeAway/removed when known).
 *
 * @property {number} added
 *   Number of element-add records matching this selector.
 *
 * @property {number} removed
 *   Number of element-remove records matching this selector (best-effort).
 *
 * @property {number} changed
 *   Number of selector-membership transitions where an element
 *   went from NOT matching → matching this selector due to non-structural mutation
 *   (attribute changes).
 *
 * @property {number} changeAway
 *   Number of selector-membership transitions where an element
 *   went from matching → NOT matching this selector due to non-structural mutation.
 *
 * @property {number} lastAt
 *   Timestamp of the most recent record affecting this selector.
 */

/**
 * @typedef {Object} SelectorEvent
 *
 * A selector-scoped event emitted in addition to the global batch event.
 *
 * Fires when this selector has any relevant records in the delivered batch.
 * Includes:
 *  - Structural changes: `added`, `removed`
 *  - Selector-membership transitions from non-structural mutations:
 *      `changed`    (non-match → match)
 *      `changeAway` (match → non-match)
 *
 * NOTE:
 *  - `changed`/`changeAway` are membership transitions, not “all attribute changes”.
 *    They are only emitted when the selector match status flips.
 *  - If attribute observation is disabled for this selector (or globally),
 *    `changed`/`changeAway` will remain empty.
 *  - Records may list multiple selectors; this event is scoped by the `selector` field.
 *
 * @property {number} at
 *   Timestamp when this selector event was delivered.
 *
 * @property {string} selector
 *   The selector this event applies to.
 *
 * @property {DomChangeRecord[]} added
 *   Added elements matching this selector.
 *
 * @property {DomChangeRecord[]} removed
 *   Removed elements matching this selector (best-effort).
 *
 * @property {DomChangeRecord[]} changed
 *   Elements that transitioned from NOT matching → matching this selector.
 *
 * @property {DomChangeRecord[]} changeAway
 *   Elements that transitioned from matching → NOT matching this selector.
 *
 * @property {number} batchAt
 *   Timestamp of the originating batch.
 *
 * @property {string[]} enabledSelectors
 *   Snapshot of enabled selectors at batch delivery time.
 */

/**
 * @typedef {Object} SelectorOpts
 * @property {boolean} [observeAttributes=false]
 * @property {AttributeFilterInput} [attributeFilter]
 *   Attribute names to include (string treated as single-item list; null disables filtering).
 */
