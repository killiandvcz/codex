import { Block } from '../block.svelte';

export class Text extends Block {
    /** @param {import('../codex.svelte').Codex} codex */
    constructor(codex) {
        super(codex, 'text');
        
        $effect.root(() => {
            $effect(() => {
                if (this.element) {
                    // if nothing in text block add a br
                    if (!this.element.innerHTML.trim()) {
                        this.element.innerHTML = '<br>';
                    }
                }
            })
        })
    }
    
    /** @type {HTMLSpanElement?} */
    element = $state(null);
    
    text = $state('');

    debug = $derived("text");

    /** @param {InputEvent} e */
    oninput = e => {
        this.refresh();
    }

    refresh = () => {
        if (this.element) this.text = this.element.innerText;
        else this.text = '';
    }
}