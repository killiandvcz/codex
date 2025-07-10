export class Block {
    /** @param {import('./codex.svelte').Codex?} codex @param {string} [type="block"] */
    constructor(codex, type = "block") {
        this.codex = codex;
        this.type = type;
        this.id = crypto.randomUUID();
    }
    
    /** @type {import('svelte').Component?} */
    component = $derived(this.codex?.components[this.type] || null);

    /** @type {Block?} */
    parent = $derived(this.codex?.recursive.find(block => block instanceof MegaBlock && block?.children.includes(this)) || null);

    /** @type {HTMLElement?} */
    element = $state(null);

    index = $derived(this.codex?.recursive.indexOf(this));
}

export class MegaBlock extends Block {
    /** @param {import('./codex.svelte').Codex?} codex @param {string} [type="block"] @param {typeof Block[]} blocks */
    constructor(codex, type = "block", blocks = []) {
        super(codex, type);

        /** @type {typeof Block[]} */
        this.blocks = blocks;
    }
    
    /** @type {Block[]} */
    children = $state([]);
    
    /** @type {Block[]} */
    recursive = $derived(this.children.flatMap(child => {
        if (child instanceof MegaBlock) return [child, ...child.recursive];
        else return [child];
    }));

    endpoints = $derived(this.recursive.filter(block => !(block instanceof MegaBlock)));
}