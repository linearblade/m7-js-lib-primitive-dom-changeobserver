/**
 * DomChangeObserver
 *
 * Reports DOM changes filtered by selector(s).
 *
 * Does:
 *  - Observe DOM mutations
 *  - Match elements against selectors
 *  - Batch and report structural and attribute changes
 *
 * Does NOT:
 *  - Attach jobs
 *  - Run jobs
 *  - Mutate application state
 *  - Schedule work beyond batching delivery
 *
 * This is a low-level DOM primitive. It reports facts; it does not decide behavior.
 */


/**
 * @class DomChangeObserver
 *
 * A DOM mutation observer that tracks element additions, removals,
 * attribute changes, and selector change-away events.
 
 * Per-selector event handlers are optional and fire only for
 * structural add/remove changes, never for attribute-derived changes.
 *
 * Supports:
 *  - Multiple selectors
 *  - Selector enable/disable (partial pause)
 *  - Global batch delivery
 *  - Optional per-selector event handlers
 *  - Pull- or push-style consumption
 */
export default class DomChangeObserver {
    /**
     * @constructor
     * @param {Object} opts
     * @param {Element|Document} [opts.root=document.body]
     *   Root node to observe.
     *
     * @param {string|string[]} [opts.selectors=[]]
     *   Initial selector(s) to register.
     *
     * @param {boolean} [opts.includeSubtreeMatches=true]
     *   When a node is added or removed, also match descendants.
     *
     * @param {boolean} [opts.observeAttributes=false]
     *   Whether to observe attribute mutations.
     *
     * @param {string[]} [opts.attributeFilter]
     *   Optional attribute filter (used only when observeAttributes is true).
     *
     * @param {number} [opts.debounceMs=0]
     *   Batch delivery debounce in milliseconds.
     *
     * @param {(batch: DomChangeBatch) => void} [opts.onChange]
     *   Optional global batch callback. Fires for every delivered batch.
     */
    constructor(opts = {}) {
	this.opts = {
	    root: (typeof document !== "undefined" ? document.body : null),
	    selectors: [],
	    includeSubtreeMatches: true,
	    observeAttributes: false,
	    attributeFilter: null,
	    debounceMs: 0,
	    onChange: null,
	    ...opts,
	};

	//this._selectors = this._normalizeSelectors(this.opts.selectors);
	// Selector registry (foundation for listing, stats, and future per-selector control)
	this._selectorTable = new Map(); // selector -> { selector, enabled, stats }
	this._selectors = [];            // cached list of enabled selectors (fast path)
	this._setSelectorTable(this.opts.selectors);

	// Tracks last known matching selectors per element.
	// Used to attribute "changeAway" to selectors when an element stops matching.
	this._lastMatched = new WeakMap(); // Element -> Set<string>
	
	this._observer = null;
	this._running = false;

	this._pending = {
	    added: new Map(),      // el -> Set(selector)
	    removed: new Map(),    // el -> Set(selector)
	    changed: new Map(),    // el -> Set(selector) (attributes)
	    changeAway : new Map(),
	};

	this._timer = null;
    }

    // ---------------------------
    // Public API
    // ---------------------------

    /**
     * Replace all selectors with a new set.
     * This is a hard reset: existing selector state and stats are discarded.
     *
     * @param {string|string[]} selectors
     */
    setSelectors(selectors) {
	//this._selectors = this._normalizeSelectors(selectors);
	this._setSelectorTable(selectors);
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
     * Add a selector with an optional per-selector event handler.
     *
     * @param {string} selector
     * @param {(evt: SelectorEvent) => void} [onEvent]
     * @returns {boolean} True if added.
     */
    
    add(selector, onEvent) {
	return this.addSelector(selector, { onEvent });
    }

    
    /**
     * Remove a selector.
     *
     * @param {string} selector
     * @returns {boolean} True if removed.
     */
    remove(selector) {
	return this.removeSelector(selector);
    }
    

    /**
     * Add a selector (internal form with options).
     *
     * @param {string} selector
     * @param {Object} [opts]
     * @param {(evt: SelectorEvent) => void} [opts.onEvent]
     * @returns {boolean}
     */
    addSelector(sel, opts = {}) {
	const s = this._coerceSelector(sel);
	if (!s) return false;
	if (this._selectorTable.has(s)) return false;

	const entry = this._makeSelectorEntry(s);

	// Optional per-selector handler
	if (opts && typeof opts.onEvent === "function") {
	    entry.onEvent = opts.onEvent;
	}

	this._selectorTable.set(s, entry);
	this._rebuildSelectorCache();
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
        return true;
    }

    /**
     * Disable a selector (partial pause).
     *
     * @param {string} selector
     * @param {Object} [opts]
     * @param {boolean} [opts.dropPending=false]
     *   Whether to drop pending records for this selector.
     * @returns {boolean}
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
     * @param {string} selector
     * @returns {boolean}
     */
    resumeSelector(sel) {
        return this.setSelectorEnabled(sel, true);
    }

    /**
     * Enable or disable a selector.
     *
     * @param {string} selector
     * @param {boolean} on
     * @returns {boolean}
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
     * @returns {boolean} True if started or already running.
     */
    start() {
	if (this._running) return true;
	if (typeof MutationObserver === "undefined") return false;

	const root = this.opts.root || (typeof document !== "undefined" ? document.body : null);
	if (!root) return false;

	this._observer = new MutationObserver((mutations) => this._onMutations(mutations));
	this._observer.observe(root, this._buildObserveOptions());

	this._running = true;
	return true;
    }

    /**
     * Stop observing and clear all pending state.
     */
    stop() {
	if (this._observer) {
	    try { this._observer.disconnect(); } catch {}
	}
	this._observer = null;
	this._running = false;

	if (this._timer) {
	    clearTimeout(this._timer);
	    this._timer = null;
	}
	this._clearPending();
	this._lastMatched = new WeakMap();
    }

    /**
     * Pause observing without clearing pending batches.
     */
    pause() {
	if (!this._running) return true;

	if (this._observer) {
	    try { this._observer.disconnect(); } catch {}
	}
	this._observer = null;
	this._running = false;

	// Cancel scheduled delivery, but keep _pending intact
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
     * Returns and clears pending batch without invoking callbacks.
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

    _buildObserveOptions() {
	const o = {
	    childList: true,
	    subtree: true,
	};

	if (this.opts.observeAttributes) {
	    o.attributes = true;
	    if (Array.isArray(this.opts.attributeFilter) && this.opts.attributeFilter.length) {
		o.attributeFilter = this.opts.attributeFilter;
	    }
	}

	return o;
    }

    _normalizeSelectors(sel) {
	if (!sel) return [];
	if (Array.isArray(sel)) return sel.filter(Boolean).map(String);
	return [String(sel)];
    }

    
    _coerceSelector(sel) {
        if (sel === null || sel === undefined) return "";
        const s = String(sel).trim();
        return s;
    }

    _makeSelectorEntry(sel) {
        return {
            selector: sel,
            enabled: true,
	    onEvent : null,
            stats: {
		events : 0,
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
	const list = this._normalizeSelectors(selectors);
	this._selectorTable.clear();
	for (const sel of list) {
	    // Default entry; stats are intentionally cheap and cumulative.
	    this._selectorTable.set(sel, this._makeSelectorEntry(sel));
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
		this._collectAttributeChange(m.target);
	    }
	}

	this._scheduleDeliver();
    }

    _collectFromNode(kind, node) {
	if (!node || node.nodeType !== 1) return;

	// Match the node itself, and optionally its subtree
	this._matchElement(kind, node);

	if (this.opts.includeSubtreeMatches && node.querySelectorAll) {
	    for (const sel of this._selectors) {
		let list;
		try { list = node.querySelectorAll(sel); } catch { continue; }
		for (const el of list) this._record(kind, el, sel);
	    }
	}
    }

    _collectAttributeChange(target) {
	const el = target;
	if (!el || el.nodeType !== 1) return;

	const prev = this._lastMatched.get(el); // Set<string> | undefined

	// Compute current matches against enabled selectors
	const matchedNow = [];
	for (const sel of this._selectors) {
	    if (this._matches(el, sel)) matchedNow.push(sel);
	}
	const nowSet = new Set(matchedNow);

	// 1) changed: any selectors that match *now*
	for (const sel of matchedNow) {
	    this._record("changed", el, sel);
	}

	// 2) changeAway: selectors that matched previously but do not match now
	if (prev && prev.size) {
	    for (const sel of prev) {
		if (!nowSet.has(sel)) this._recordChangeAway(el, sel);
	    }
	}

	// 3) Update last-known matches
	if (matchedNow.length) {
	    this._lastMatched.set(el, nowSet);
	} else {
	    // If it matches nothing now, forget history (we already emitted changeAway above)
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
    _recordChangedRaw(el) {
	let set = this._pending.changed.get(el);
	if (!set) {
	    set = new Set();
	    this._pending.changed.set(el, set);
	}
	// intentionally do not add any selector
    }
    /*
    //cant pull 'change aways'
    _collectAttributeChange(target) {
    const el = target;
    if (!el || el.nodeType !== 1) return;

    // Only report attribute changes if element matches selectors
    for (const sel of this._selectors) {
    if (this._matches(el, sel)) this._record("changed", el, sel);
    }
    }
    */
    _matchElement(kind, el) {
	for (const sel of this._selectors) {
	    if (this._matches(el, sel)) this._record(kind, el, sel);
	}
    }

    _matches(el, sel) {
	try { return !!el.matches && el.matches(sel); } catch { return false; }
    }

    _record(kind, el, sel) {
	const map =
	      kind === "added" ? this._pending.added :
	      kind === "removed" ? this._pending.removed :
	      this._pending.changed;

	let set = map.get(el);
	if (!set) {
	    set = new Set();
	    map.set(el, set);
	}
	set.add(sel);
	this._bumpSelectorStat(sel, kind);
	
	// Remember last-known selector matches for this element
	let last = this._lastMatched.get(el);
	if (!last) {
	    last = new Set();
	    this._lastMatched.set(el, last);
	}
	last.add(sel);
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

	// 2) Per-selector onEvent (conditional; added/removed only)
	for (const entry of this._selectorTable.values()) {
	    if (!entry || !entry.enabled) continue;
	    const fn = entry.onEvent;
	    if (typeof fn !== "function") continue;

	    const sel = entry.selector;

	    const added = this._recordsForSelector(batch.added, sel);
	    const removed = this._recordsForSelector(batch.removed, sel);

	    // Fire only if added/removed has relevant records
	    if (!added.length && !removed.length) continue;

	    const evt = {
		at: Date.now(),
		selector: sel,

		// only the portions relevant to this selector
		added,
		removed,

		// useful context, without re-slicing everything
		batchAt: batch.at,
		enabledSelectors: batch.selectors,
	    };

	    try { fn(evt); } catch {}
	}

	return batch;
    }
    /*
    //old , delete after testing
    _deliverIfPending() {
    const batch = this._buildBatchFromPending();
    if (!batch) return null;

    // Clear before calling user code to avoid re-entrancy weirdness
    this._clearPending();

    const cb = this.opts.onChange;
    if (typeof cb === "function") {
    try { cb(batch); } catch {}
    }

    return batch;
    }
    */
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
}

/**
 * @typedef {Object} DomChangeRecord
 * @property {Element} el
 *   The affected element.
 * @property {string[]} selectors
 *   Selectors that matched this element.
 */

/**
 * @typedef {Object} DomChangeBatch
 * @property {number} at
 *   Timestamp of batch creation.
 * @property {string[]} selectors
 *   Enabled selectors at delivery time.
 * @property {DomChangeRecord[]} added
 * @property {DomChangeRecord[]} removed
 * @property {DomChangeRecord[]} changed
 * @property {DomChangeRecord[]} changeAway
 */

/**
 * @typedef {Object} SelectorStats
 *
 * Cumulative statistics for a selector since registration
 * or since the last hard reset (setSelectors).
 *
 * @property {number} events
 *   Total number of selector-related events of any kind.
 *   Includes added, removed, changed, and changeAway.
 *
 * @property {number} matched
 *   Total number of times this selector participated in a recorded event.
 *   This includes positive matches and changeAway events.
 *
 * @property {number} added
 *   Number of element-add events matching this selector.
 *
 * @property {number} removed
 *   Number of element-remove events matching this selector.
 *
 * @property {number} changed
 *   Number of attribute-change events where the element
 *   continued to match this selector.
 *
 * @property {number} changeAway
 *   Number of times an element previously matching this selector
 *   stopped matching it due to attribute mutation.
 *
 * @property {number} lastAt
 *   Timestamp of the most recent event affecting this selector.
 */

/**
 * @typedef {Object} SelectorEvent
 *
 * A selector-scoped event emitted in addition to the global batch event.
 *
 * NOTE:
 *  - Selector events fire ONLY for structural DOM changes:
 *    element additions and removals.
 *  - Attribute-derived changes (`changed`, `changeAway`) do NOT trigger
 *    selector events.
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
 *   Removed elements matching this selector.
 *
 * @property {number} batchAt
 *   Timestamp of the originating batch.
 *
 * @property {string[]} enabledSelectors
 *   Snapshot of enabled selectors at batch delivery time.
 */
