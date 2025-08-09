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
    
    /** 
     * The offset of the linebreak within its parent block. (Not reactive)
     * @type {Number}
     */
    get offset() {
        return Array.from(this.element?.parentNode?.childNodes || []).indexOf(this.element) || 0;
    }
    
    debug = $derived(`\\n (${this.start} - ${this.end}) [${this.offset}]`);

    /** @type {Boolean} */
    selected = $derived(super.selected || this.codex?.selection?.anchoredBlocks.includes(this) || false);

    
    
    /** @param {KeyboardEvent} e @param {Function} ascend */
    onkeydown = (e, ascend) => {
        if (e.key === 'Backspace') {
            e.preventDefault();
            if (this.selected) {
                console.log('Backspace pressed on linebreak');
                const parent = this.parent;
                const previous = parent?.children?.find(child => child.index === this.index - 1);
                console.log('Previous block:', previous);
                console.log(previous === this);
                
                if (previous) {
                    this.delete();
                    previous.focus?.(-1, -1);
                } else {
                    // this.parent.onkeydown?.(e);
                    ascend();
                }
            }
        } else ascend()
    }
    
    /** @param {InputEvent} e */
    onbeforeinput = e => {
        e.preventDefault();
        if (this.parent && this.parent instanceof MegaBlock) {
            if (this.parent.blocks.find(block => block === Text) && this.codex) {
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
                            focus();
                        }
                    })
                    focus();
                }   
            } 
        }
    }

    onfocus = () => {
        
    }

    delete = () => this.parent && (this.parent.children = this.parent?.children.filter(child => child !== this));

    /** @param {Null} [s] @param {Null} [e] @param {Number} [attempts] */
    focus = (s, e, attempts) => requestAnimationFrame(() => {  
        if (this.element) {
            const strategy = this.parent?.strategies?.find(s => s.tags.includes('refocus'));
            if (strategy && strategy.canHandle(this.codex, { block: this })) {
                console.log(`Executing strategy "${strategy.name}" for refocus on block "${this.type}"`);
                
                strategy.execute(this.codex, { block: this });
                return;
            }
            const data = this.getFocusData();
            if (data) this.codex?.selection?.setRange(data.startElement, data.startOffset, data.endElement, data.endOffset);
        } else {
            console.warn('Linebreak element is not available yet.');
            if (attempts === undefined) attempts = 0;
            if (attempts < 10) {
                this.focus(null, null, attempts + 1);
            }
        }
    });

    /** Returns the focus data for the linebreak element */
    getFocusData = () => {
        if (this.element) {
            const parentElement = this.element.parentElement;
            if (!parentElement) return;
            const blockOffset = Array.from(parentElement?.childNodes).indexOf(this.element);
            return {
                startElement: parentElement,
                endElement: parentElement,
                startOffset: blockOffset,
                endOffset: blockOffset,
            };
        }
    }
}