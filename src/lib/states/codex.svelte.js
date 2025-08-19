/**
* @typedef {Object} CodexInit
* @property {Object<string, import('svelte').Component>} [components] - Initial blocks to be added to the codex.
* @property {(codex: Codex) => void} [onInit] - Callback function to be called when the codex is initialized.
* @property {import('./strategy.svelte').Strategy[]} [strategies] - Initial strategies to be added to the codex.
*/

import CodexComponent from '$lib/components/Codex.svelte';
import TextComponent from '$lib/components/Text.svelte';
import ParagraphComponent from '$lib/components/Paragraph.svelte';
import { MegaBlock } from './block.svelte';
import { Paragraph } from './blocks/paragraph.svelte';
import { CodexSelection } from './selection.svelte';
import { Text as TextBlock } from './blocks/text.svelte';
import LinebreakComponent from '$lib/components/Linebreak.svelte';
import { TextSystem } from './systems/textSystem.svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { multiBlockBackspaceStrategy } from './strategies/multiBlockBackspace.svelte';

export const initialComponents = {
    codex: CodexComponent,
    text: TextComponent,
    paragraph: ParagraphComponent,
    linebreak: LinebreakComponent
}

export const initialBlocks = [
    Paragraph,
]

export const initialSystems = {
    text: TextSystem,
}

export const initialStrategies = [
    multiBlockBackspaceStrategy
]

/**
* @param {Codex} codex
*/
export const onInit = codex => {
    const lastChild = codex.children[codex.children.length - 1];
    if (!lastChild || !(lastChild instanceof Paragraph)) {
        codex.children = [...codex.children, new Paragraph(codex)];
    }
}

export class Codex extends MegaBlock {
    /**
    * Creates an instance of Codex.
    * @param {CodexInit} [init] - Initial configuration for the codex.
    */
    constructor(init = {}) {
        super(null, {
            type: 'codex',
            blocks: [ Paragraph ],
            strategies: init.strategies || initialStrategies
        });
        
        /** @type {Object<string, import('svelte').Component>} */
        this.components = init.components || initialComponents;
        
        this.selection = new CodexSelection(this);

        /** @type {SvelteSet<import('./operations.svelte').Operation>} */
        this.history = new SvelteSet();
        
        this.systems = new SvelteMap();
        for (const [name, System] of Object.entries(initialSystems)) {
            try {
                this.systems.set(name, new System(this));
                console.log(`Initialized system "${name}"`);
            } catch (error) {
                console.error(`Failed to initialize system "${name}":`, error);
            }
        }
        
        $effect.root(() => {
            $effect(() => {
                if (this.element) {
                    this.selection.observe(this.element);
                    init.onInit?.(this) || onInit(this);
                }
            })
        })
    }
    
    /** @type {HTMLDivElement?} */
    element = $state(null);
    
    // debug = $derived({
    //     elements: this.children.map(child => child.debug || {}),
    // });
    
    debug = $derived(`codex |\n${this.children.map(child => child.debug || {}).join(' + ')}`);
    
    
    // findCommonParent = () => {
        //     if (this.selection.collapsed) return this.selection.anchoredBlock?.parent;
    //     if (this.selection.isMultiBlock) {
    //         const parents = this.recursive.filter(block => )
        //     }
    // }
    
    
    /** @param {InputEvent} e */
    onbeforeinput = e => {
        let currentParent = this.selection?.parent;
        if (currentParent && currentParent instanceof MegaBlock) {
            while (currentParent) {
                const strategy = currentParent.strategies?.filter(s => s.tags.includes('beforeinput')).find(s => s.canHandle(this, {event: e}));
                if (strategy) {
                    e.preventDefault();
                    strategy.execute(this, {event: e, block: currentParent});
                    return;
                }
                currentParent = currentParent.parent || (currentParent === this ? null : this);
            }
        } else if (currentParent) {
            this.selection?.anchoredBlocks.forEach(block => block['onbeforeinput']?.(e));
        } else {
            // console.warn('No current parent block found for beforeinput event');
            e.preventDefault();
        }
    }
    
    /** @param {InputEvent} e */
    oninput = e => {
        if (this.selection?.anchoredBlocks) {
            this.selection.anchoredBlocks.forEach(block => {
                const handler = block['oninput'];
                if (handler && typeof handler === 'function') {
                    handler(e);
                }
            });
        }
    }
    
    /** @param {KeyboardEvent} e */
    onkeydown = e => {
        const context = {event: e};
        
        let currentParent = this.selection?.parent;
        if (currentParent && currentParent instanceof MegaBlock) {
            while (currentParent) {
                const strategy = currentParent.strategies?.filter(s => s.tags.includes('keydown')).find(s => s.canHandle(this, context));
                if (strategy) {
                    e.preventDefault();
                    strategy.execute(this, {...context, block: currentParent});
                    return;
                }
                currentParent = currentParent.parent || (currentParent === this ? null : this);
            }
        } else if (currentParent) {
            const handlers = this.selection?.anchoredBlocks.map(block => block['onkeydown']).filter(handler => typeof handler === 'function');
            let handler = handlers.at(-1);
            const ascend = () => {
                const hIndex = handlers.indexOf(handler);
                if (hIndex > 0) handler = handlers[hIndex - 1];
                handler(e, ascend);
            };
            handler(e, ascend);
        } else {
            // console.log('No current parent block found for keydown event');
            // e.preventDefault();
        }
    }
    
    
    
}