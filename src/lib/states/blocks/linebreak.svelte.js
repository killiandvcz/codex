import { Block, MegaBlock } from "../block.svelte";
import { Text } from "./text.svelte";

export class Linebreak extends Block {
    /** @param {import('../codex.svelte').Codex} codex */
    constructor(codex) {
        super(codex, {
            type: 'linebreak'
        });
    }
    
    
    
    /** @type {HTMLBRElement?} */
    element = $state(null);
    
    start = $derived(this.before ? (this.before.end ?? 0) + 1 : 0);
    end = $derived(this.start);
    
    debug = $derived(`\\n (${this.start} - ${this.end})`);
    
    /** @param {KeyboardEvent} e */
    onkeydown = e => {
        // e.preventDefault();
        
        // if (this.parent && this.parent instanceof MegaBlock) {
        //     const Text = this.parent?.blocks.find(block => block.type === 'text');
        //     if (Text) {

        //         
        //     }
        // }
    }
    
    /** @param {InputEvent} e */
    onbeforeinput = e => {
        console.warn('Linebreak onbeforeinput', e);
        e.preventDefault();
        if (this.parent && this.parent instanceof MegaBlock) {
            
            if (this.parent.blocks.find(block => block === Text) && this.codex) {
                console.warn(e);
                
                if (e.inputType === 'insertText' && e.data) {
                    const newText = new Text(this.codex, { text: e.data || '', bold: false, italic: false, underline: false, strikethrough: false, code: false });
                    const index = this.parent.children.indexOf(this);
                    if (index !== -1) {
                        this.parent.children.splice(index, 0, newText);
                    } else {
                        this.parent.children.push(newText);
                    }
                    const focus = () => requestAnimationFrame(() => {
                        if (newText.element) {
                            this.codex?.selection?.setRange(newText.element, e.data.length, newText.element, e.data.length);
                        } else {
                            console.warn('New text element is not available yet.');
                            focus();
                        }
                    })
                    focus();
                }
                
                
            }
            
        }
    }
}