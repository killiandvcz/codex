/**
 * @typedef {Object} CodexInit
 * @property {Object<string, import('svelte').Component>} [components] - Initial blocks to be added to the codex.
 * @property {(codex: Codex) => void} [onInit] - Callback function to be called when the codex is initialized.
 */

import CodexComponent from '$lib/components/Codex.svelte';
import TextComponent from '$lib/components/Text.svelte';
import ParagraphComponent from '$lib/components/Paragraph.svelte';
import { MegaBlock } from './block.svelte';
import { Paragraph } from './blocks/paragraph.svelte';
import { CodexSelection } from './selection.svelte';
import { Text as TextBlock } from './blocks/text.svelte';
import LinebreakComponent from '$lib/components/Linebreak.svelte';
import { parseCoordinatesDestructured } from '$lib/utils/coordinates';
import { TextSystem } from './systems/textSystem.svelte';
import { SvelteMap } from 'svelte/reactivity';

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
            blocks: [ Paragraph ]
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
        // console.log(this.selection.anchoredBlocks);
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
        // console.log(this.selection.anchoredBlocks);
        if (this.selection?.anchoredBlocks) {
            this.selection.anchoredBlocks.forEach(block => {
                const handler = block['onkeydown'];
                if (handler && typeof handler === 'function') {
                    handler(e);
                }
            });
        }
    }



    /**
     * Replaces blocks in the codex between two indices with new blocks.
     * @param {String} x1 
     * @param {String} x2 
     * @param {import('./block.svelte').Block[]} replaceWith
     */
    replace = (x1, x2, replaceWith) => {
        const [anchorCoords, anchorData] = parseCoordinatesDestructured(x1);
        const [focusCoords, focusData] = parseCoordinatesDestructured(x2);
        // console.log('replace', { x1, x2, anchorCoords, anchorData, focusCoords, focusData, replaceWith });
    }



}