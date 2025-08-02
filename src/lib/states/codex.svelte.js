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
import { SvelteMap } from 'svelte/reactivity';
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
        if (this.selection?.anchoredBlocks) {
            this.selection.anchoredBlocks.forEach(block => {
                const handler = block['onbeforeinput'];
                if (handler && typeof handler === 'function') {
                    handler(e);
                }
            });
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
                // console.log(`Checking strategies for keydown event on block "${currentParent.type}"`);
                
                const strategy = currentParent.strategies?.filter(s => s.tags.includes('keydown')).find(s => s.canHandle(this, context));
                if (strategy) {
                    // console.log(`Executing strategy "${strategy.name}" for keydown event on block "${currentParent.type}"`);
                    
                    e.preventDefault();
                    strategy.execute(this, context);
                    return;
                }
                currentParent = currentParent.parent || (currentParent === this ? null : this);
            }
        } else if (currentParent) {
            // console.log(`No strategies found for keydown event on block "${currentParent.type}"`);
            this.selection?.anchoredBlocks.forEach(block => block['onkeydown']?.(e));
        } else {
            console.log('No current parent block found for keydown event');
        }
    }
    
    
    
}