import { MegaBlock } from "../block.svelte";
import { Text } from "./text.svelte";

export class Paragraph extends MegaBlock {
    /**
     * @param {import('../codex.svelte').Codex} codex
     */
    constructor(codex) {
        super(codex, 'paragraph');

        $effect.root(() => {
            $effect(() => {
                if (this.element) {
                    const lastChild = this.children[this.children.length - 1];
                    if (!lastChild ) {
                        const text = new Text(this.codex);
                        this.children = [...this.children, text];
                    }
                }
            })
        });
    }

    /** @type {HTMLParagraphElement?} */
    element = $state(null);


    debug = $derived({
        id: this.id,
        type: this.type,
        text: this.children.map(child => child.debug)
    });

    /** @param {InputEvent} e */
    oninput = e => {
        
    }

    /** @param {KeyboardEvent} e */
    onkeydown = e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const range = this.codex.selection.range;
            if (range) {
                console.log('range', range);
                
                
            }
        }

        if (e.key === 'Backspace') {
            e.preventDefault();
            const start = this.codex.selection.start;
            const end = this.codex.selection.end;

            console.log('start', start);
        }
    }
}