/**
 * @typedef {Object} CodexInit
 * @property {Object<string, import('svelte').Component>} [components] - Initial blocks to be added to the codex.
 */

import CodexComponent from '$lib/components/Codex.svelte';
import TextComponent from '$lib/components/Text.svelte';
import ParagraphComponent from '$lib/components/Paragraph.svelte';
import { MegaBlock } from './block.svelte';
import { Paragraph } from './blocks/paragraph.svelte';
import { CodexSelection } from './selection.svelte';
import { Text as TextBlock } from './blocks/text.svelte';

export const initialComponents = {
    codex: CodexComponent,
    text: TextComponent,
    paragraph: ParagraphComponent,
}

export class Codex extends MegaBlock {
    /**
     * Creates an instance of Codex.
     * @param {CodexInit} [init] - Initial configuration for the codex.
     */
    constructor(init = {}) {
        super(null, 'codex', [ Paragraph ]);

        /** @type {Object<string, import('svelte').Component>} */
        this.components = init.components || initialComponents;

        this.selection = new CodexSelection(this);

        $effect.root(() => {
            $effect(() => {
                if (this.element) {
                    const lastChild = this.children[this.children.length - 1];
                    if (!lastChild || !(lastChild instanceof Paragraph)) {
                        const paragraph = new Paragraph(this);
                        this.children = [...this.children, paragraph];
                    }
                }
            })
        })
    }

    /** @type {HTMLDivElement?} */
    element = $state(null);

    debug = $derived({
        elements: this.children.map(child => child.debug || {}),
    });


    /** @param {InputEvent} e */
    oninput = e => {
        // Plus besoin de recalculer, utilise this.selection
        if (this.selection?.blocks) {
            this.selection.blocks.forEach(block => {
                if (block.oninput) block.oninput(e);
            });
        }
    }

    /** @param {KeyboardEvent} e */
    onkeydown = e => {
        if (this.selection?.blocks) {
            this.selection.blocks.forEach(block => {
                if (block.onkeydown) block.onkeydown(e);
            });
        }
    }

}