/** 
* @typedef {Object} BlockOperation
* @property {string} type - The type of operation (e.g., "insert", "delete", "replace").
* @property {string[]} params - Parameters for the operation, such as coordinates or block IDs.
* @property {string} handler - The name of the handler function to execute for this operation.
*/

import Codex from '$lib/components/Codex.svelte';

/**
* @typedef {Object} BlockManifest
* @property {string} type - The type of block (e.g., "paragraph", "text", "linebreak").
* @property {Object<string, BlockOperation>} [operations] - A map of operation types to their handlers.
* @property {import('./capability.svelte').Capability[]} capabilities - The capabilities of the block.
*/

/**
* @typedef {BlockManifest & {
*   blocks: typeof Block[];
*   strategies?: import('./strategy.svelte').Strategy[];
* }} MegaBlockManifest
*/

/**
 * @typedef {Object} BlockObject
 * @property {string} [id] - The unique identifier for the block.
 * @property {string} type - The type of the block (e.g., "paragraph", "text").
 */


/**
 * @callback BlockMethod
 * @param {...any} args - Additional arguments for the method.
 */


export class Block {
    /** @param {import('./codex.svelte').Codex?} codex @param {BlockManifest} manifest @param {string?} id */
    constructor(codex, manifest, id = null) {
        this.codex = codex;
        this.id = $state(id || crypto.randomUUID());
        this.manifest = $state(manifest);
        this.type = $derived(this.manifest?.type || "block");

        this.capabilities = new Set();
        if (manifest.capabilities) {
            for (const capability of manifest.capabilities) {
                this.capabilities.add(capability);
            }
        }

        /**
         * A set of methods available on the block.
         * @type {Map<string, Function>}
         */
        this.methods = new Map();

        this.method('delete', () => this.rm());


    }

    /** @type {import('svelte').Component?} */
    component = $derived(this.codex?.components[this.type] || null);

    unlink = $derived(this.codex?.recursive.includes(this) === false);
    
    /** @type {Number} */
    index = $derived(this.codex?.recursive.indexOf(this) ?? -1);
    
    /** @type {MegaBlock?} */
    parent = $derived(this.type === "codex" ? null : this.codex?.recursive.find(block => block instanceof MegaBlock && block?.children.includes(this)) || this.codex);
    
    /** @type {Block?} */
    globalBefore = $derived((this.index && this.codex?.recursive.find(block => block.index === this.index - 1)) || null);
    
    /** @type {Block?} */
    globalAfter = $derived((this.index && this.codex?.recursive.find(block => block.index === this.index + 1)) || null);
    
    /** @type {Block?} */
    before = $derived((this.index && this.parent instanceof MegaBlock && this.parent.children?.find(b => b.index === this.index - 1)) || null);
    
    /** @type {Block?} */
    after = $derived((this.index && this.parent instanceof MegaBlock && this.parent.children?.find(b => b.index === this.index + 1)) || null);

    /** @type {Boolean} */
    first = $derived(this.parent?.children[0] === this);
    
    /** @type {Boolean} */
    last = $derived(this.parent?.children[this.parent.children.length - 1] === this);

    /** @type {HTMLElement?} */
    element = $state(null);
    
    selected = $derived(this.codex?.selection && this.element && this.codex.selection?.range?.intersectsNode(this.element));
    
    /** @type {Number} */
    depth = $derived(this.parent ? this.parent.depth + 1 : 0);
    
    /** @type {Number[]} */
    path = $derived.by(() => {
        if (this.parent && this.parent instanceof MegaBlock) return [...this.parent.path, this.index];
        else return [];
    });

    /** @param {Capability} capability */
    can = capability => this.capabilities.has(capability)

    /**
     * Removes the block from its parent.
     */
    rm = () => {
        if (this.parent) {
            this.parent.children = this.parent.children.filter(child => child !== this); 
            return true;
        }
        return false;
    }


    /** @type {Object<string, any>} */
    metadata = $state({});
    
    /** @param {String} operation */
    supports = operation => this.manifest?.operations && operation in this.manifest.operations || false;
    
    /** @param {String} operation @param {Array<any>} params */
    execute = (operation, ...params) => {
        const handlerName = this.manifest?.operations?.[operation]?.handler;
        /** @type {Function?} */
        const handler = handlerName && this[handlerName];
        if (!handler) throw new Error(`Handler for operation "${operation}" not found in block "${this.type}".`);
        if (typeof handler !== 'function') throw new Error(`Handler "${handlerName}" is not a function in block "${this.type}".`);
        return handler(...params);
    }

    /**
     * Adds a method to the block.
     * @param {String} name
     * @param {BlockMethod} callback
     */
    method = (name, callback) => this.methods.set(name, callback);

    /**
     * Calls a method on the block.
     * @param {String} name
     * @param {...any} args
     * @returns {any}
     */
    call = (name, ...args) => {
        this.log(`Calling method "${name}" with args:`, args);
        const method = this.methods.get(name);
        if (!method) throw new Error(`Method "${name}" not found in block "${this.type}".`);
        return method(...args);
    }

    /**
     * Logs a message to the console if debugging is enabled.
     * @param  {...any} args 
     */
    log = (...args) => {
        const prefix = `${this.type}${this.index < 0 ? '-⌀' : `-${this.index}`}`.toUpperCase();
        console.log(prefix, ...args);
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type
        };
    }
}

/**
 * @template {Block} [T=Block]
 */
export class MegaBlock extends Block {
    /** @param {import('./codex.svelte').Codex?} codex @param {MegaBlockManifest} manifest */
    constructor(codex, manifest) {
        super(codex, manifest);
        
        /** @type {typeof Block[]} */
        this.blocks = manifest.blocks;
        
        /** @type {import('./strategy.svelte').Strategy[]} */
        this.strategies = manifest.strategies || [];
    }
    
    /** @type {T[]} */
    children = $state([]);
    
    /** @type {Block[]} */
    recursive = $derived(this.children.flatMap(child => {
        if (child instanceof MegaBlock) return [child, ...child.recursive];
        else return [child];
    }));
    
    endpoints = $derived(this.recursive.filter(block => !(block instanceof MegaBlock)));
    
    /** @param {Block} block */
    contains = block => this.recursive.includes(block);
    
    /** @param {import('./strategy.svelte').Strategy} strategy */
    addStrategy = strategy => this.strategies.push(strategy);

    toJSON() {
        return {
            ...super.toJSON(),
            children: this.children.map(child => child.toJSON())
        };
    }
}