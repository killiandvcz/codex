import { untrack } from 'svelte';

export class CodexSelection {
    /** @param {import('./codex.svelte').Codex} codex */
    constructor(codex) {
        this.codex = codex;
        
        
        $effect.root(() => {
            $effect(() => {
                if (this.codex.element) untrack(() => {
                    document.addEventListener('selectionchange', this.#updateSelection);
                    this.#updateSelection();
                }) 
                else this.raw = null;
                
                return () => {
                    document.removeEventListener('selectionchange', this.#updateSelection);   
                    this.raw = null;
                }
            })
        })
    }
    
    
    /** @type {Selection?} */
    raw = $state(null);
    
    /** @type {Range?} */
    range = $state(null);
    
    /** @type {Node?} */
    start = $derived(this.range ? this.range.startContainer : null);
    
    anchor = $derived(this.range ? {
        block: this.codex?.endpoints.find(block => block.element?.contains(this.start)),
    } : null);

    /** @type {Node?} */
    end = $derived(this.range ? this.range.endContainer : null);

    focus = $derived(this.range ? {
        block: this.codex?.endpoints.find(block => block.element?.contains(this.end)),
    } : null);

    /** @type {boolean} */
    collapsed = $derived(this.range ? this.range.collapsed : true);
    
    /** @type {import('./block.svelte').Block[]} */
    blocks = $derived(this.codex.recursive.filter(block => {
        if (!block.element || !this.start) return false;
        return block.element.contains(this.start);
    }));
    
    
    #updateSelection = () => {
        const selection = window.getSelection();
        
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const startContainer = range.startContainer;
            
            const isInside = this.codex.element?.contains(startContainer);
            if (!isInside) { this.raw = null; return; };
            this.raw = selection;
            this.range = range;
        }
    }
}