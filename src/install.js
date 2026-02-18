/*
 * Copyright (c) 2025 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

import DomChangeObserver from "./DomChangeObserver.js";

const MOD = "[primitive.dom.changeobserver]";
const SERVICE_ID = "primitive.dom.changeobserver";

/**
 * install(lib, opts?)
 *
 * m7-js-lib integration installer for this primitive.
 *
 * This installer is for m7-js-lib namespace/service wiring only:
 * - Registers `DomChangeObserver` at `lib.primitive.dom.changeobserver`
 * - Optionally registers a shared service instance (if `lib.service.set` exists)
 *
 * Standalone usage:
 * If you are using this library standalone, this installer is not required.
 * Import `DomChangeObserver` directly from `./DomChangeObserver.js` and create
 * instances yourself.
 *
 * @param {Object} lib
 * @param {Object} [opts]
 * @param {*} [opts.host]
 * @param {Element|Document|DocumentFragment|null} [opts.root]
 * @param {DomChangeObserver} [opts.instance]
 * @param {boolean} [opts.force=false]
 * @param {boolean} [opts.configureDefaults=true]
 * @param {boolean} [opts.start=false]
 * @returns {{
 *   namespace: Object,
 *   instance: DomChangeObserver|null,
 *   installedService: boolean
 * }}
 */
export function install(lib, opts = {}) {
    if (!lib || typeof lib !== "object") {
        throw new Error(`${MOD} install(lib) requires an m7-lib instance object.`);
    }

    if (!lib.hash || typeof lib.hash.set !== "function") {
        throw new Error(`${MOD} install(lib) requires lib.hash.set.`);
    }

    const hasHashGet = !!(lib.hash && typeof lib.hash.get === "function");
    const hasServiceSet = !!(lib.service && typeof lib.service.set === "function");
    const hasServiceGet = !!(lib.service && typeof lib.service.get === "function");

    let namespace = null;
    if (hasHashGet) {
        try {
            namespace = lib.hash.get(lib, SERVICE_ID);
        } catch (err) {
            namespace = null;
        }
    }
    if (!namespace || typeof namespace !== "object") {
        namespace = {};
    }
    namespace.DomChangeObserver = DomChangeObserver;
    lib.hash.set(lib, SERVICE_ID, namespace);

    let instance = null;
    let installedService = false;
    const shouldStart = !!(opts && opts.start === true);

    if (hasServiceSet) {
        const force = opts && opts.force === true;
        const providedInstance = opts && opts.instance ? opts.instance : null;
        const existingInstance = hasServiceGet ? lib.service.get(SERVICE_ID) : null;

        if (!force && existingInstance) {
            instance = existingInstance;
        } else if (providedInstance) {
            instance = providedInstance;
        } else {
            const host = Object.prototype.hasOwnProperty.call(opts, "host")
                ? opts.host
                : resolveHost();

            const root = Object.prototype.hasOwnProperty.call(opts, "root")
                ? opts.root
                : resolveDefaultRoot(lib, host);

            instance = new DomChangeObserver({
                host,
                root,
            });

            if (opts.configureDefaults !== false && typeof instance.configure === "function") {
                instance.configure({
                    debounceMs: 0,
                    includeSubtreeMatches: false,
                    observeAttributes: false,
                    attributeFilter: null,
                    onChange: null,
                });
            }
        }

        lib.service.set(SERVICE_ID, instance);
        namespace.instance = instance;
        installedService = true;

        // Re-write namespace to ensure `instance` is present after install.
        lib.hash.set(lib, SERVICE_ID, namespace);
    } else if (opts && opts.instance) {
        namespace.instance = opts.instance;
        lib.hash.set(lib, SERVICE_ID, namespace);
        instance = opts.instance;
    }

    if (shouldStart && instance && typeof instance.start === "function") {
        instance.start();
    }

    return {
        namespace,
        instance,
        installedService,
    };
}

export { DomChangeObserver, SERVICE_ID };
export default install;

function resolveHost(explicit) {
    if (explicit) return explicit;
    if (typeof globalThis !== "undefined") return globalThis;
    if (typeof window !== "undefined") return window;
    if (typeof global !== "undefined") return global;
    return undefined;
}

function resolveDefaultRoot(lib, host) {
    const fromEnv =
        lib &&
        lib._env &&
        lib._env.root &&
        lib._env.root.document
            ? lib._env.root.document
            : null;

    if (fromEnv && fromEnv.body) return fromEnv.body;
    if (fromEnv) return fromEnv;

    const doc = host && host.document ? host.document : null;
    if (!doc) return null;
    return doc.body || doc;
}
