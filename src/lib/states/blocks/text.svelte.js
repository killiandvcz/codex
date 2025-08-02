import { untrack } from 'svelte';
import { Block } from '../block.svelte';

/** 
* @typedef {Object} TextInit
* @property {String} [text] - Initial text content for the block.
* @property {Boolean} [bold] - Whether the text should be bold.
* @property {Boolean} [italic] - Whether the text should be italic.
* @property {Boolean} [underline] - Whether the text should be underlined.
* @property {Boolean} [strikethrough] - Whether the text should have a strikethrough.
* @property {Boolean} [code] - Whether the text should be formatted as code.
*/

export class Text extends Block {
    /** 
    * @param {import('../codex.svelte').Codex} codex
    * @param {TextInit} init */
    constructor(codex, init = {}) {
        super(codex, {
            type: 'text',
            operations: {
                truncate: {
                    type: 'truncate',
                    params: ['offset'],
                    handler: 'truncate'
                },
                split: {
                    type: 'split',
                    params: ['offset'],
                    handler: 'split'
                },
                insert: {
                    type: 'insert',
                    params: ['text', 'offset'],
                    handler: 'insert'
                },
                delete: {
                    type: 'delete',
                    params: ['from', 'to'],
                    handler: 'delete'
                }
            }
        });
        
        this.text = init.text || '';
        this.bold = init.bold || false;
        this.italic = init.italic || false;
        this.underline = init.underline || false;
        this.strikethrough = init.strikethrough || false;
        this.code = init.code || false;
        
        $effect.root(() => {
            $effect(() => {
                this.element && untrack(() => {
                    if (this.element) {
                        this.element.innerText = this.text;
                        if (!this.element.innerHTML.trim()) {
                            this.element.innerHTML = '<br>';
                        }
                    }
                })
            })
            
            $effect(() => {
                // if (!this.text) this.parent && (this.parent.children = this.parent.children.filter(c => c !== this));
                // if (!this.element) {
                //     console.warn('Text element is not available yet.');
                // }
            })
        });
    }
    
    /** @type {import('../systems/textSystem.svelte').TextSystem?} */
    system = $derived(this.codex?.systems.get('text') || null);
    
    /** @type {HTMLSpanElement?} */
    element = $state(null);
    
    text = $state('');
    
    /** @type {Number} */
    start = $derived(this.before ? (this.before.end ?? 0) + 1 : 0);
    /** @type {Number} */
    end = $derived(this.start + (this.text.length || 0));
    
    debug = $derived(`${this.text} (${this.start} - ${this.end}) [${this.selected ? 'selected' : ''}] ${this.selectionDebug}`);
    
    bold = $state(false);
    italic = $state(false);
    underline = $state(false);
    strikethrough = $state(false);
    code = $state(false);
    
    style = $derived([
        ...this.bold ? ['b'] : [],
        ...this.italic ? ['i'] : [],
        ...this.underline ? ['u'] : [],
        ...this.strikethrough ? ['s'] : [],
        ...this.code ? ['c'] : [],
    ].join(','));
    
    selection = $derived.by(() => {
        if (this.selected) {
            const selection = this.codex?.selection;
            let startOffset = null;
            let endOffset = null;
            if (selection?.startBlock?.index < this.index) {
                startOffset = 0;
            } else if (selection?.startBlock?.index === this.index) {
                startOffset = selection?.startOffset || 0;
            }
            
            if (selection?.endBlock?.index > this.index) {
                endOffset = this.text.length;
            } else if (selection?.endBlock?.index === this.index) {
                endOffset = selection?.endOffset || this.text.length;
            }
            
            if (startOffset !== null && endOffset !== null) {
                return {
                    start: startOffset,
                    end: endOffset,
                    length: endOffset - startOffset
                };
            } else {
                return null;
            }
        }
    })
    
    selectionDebug = $derived(`${this.selection ? `Selection: ${this.selection.start} - ${this.selection.end} (${this.selection.length})` : 'No selection'}`);
    
    /** @param {KeyboardEvent} e */
    onkeydown = e => {
        console.log(`Text onkeydown: ${e.key}`);
        if (e.key === 'Backspace') {
            e.preventDefault();
            if (this.selection && this.selection.length > 0) {
                this.delete(this.selection.start, this.selection.end);
            } else if (this.selection && this.selection.start > 0) {
                const parent = this.parent;
                const start = this.start;
                const previous = parent?.children?.find(child => child.index === this.index - 1);
                const deleted = this.delete(this.selection.start - 1, this.selection.start);
                // if (deleted && previous) previous.focus?.(-1, -1);
                // else 
                if (this.selection) this.focus(this.selection.start - 1, this.selection.start - 1);
                else parent?.focus(start);
            }
        }
    }
    
    /** @param {InputEvent} e */
    oninput = e => {
        this.refresh();
    }
    
    
    /** @param {InputEvent} e */
    beforeinput = e => {
        // console.warn('Text beforeinput', e);
        // e.preventDefault();
    }
    
    /** Refreshes the text content from the element */
    refresh = () => {
        // console.log('Refreshing Text block', this.element);
        if (this.element) this.text = this.element.innerText;
        else this.text = '';
    }
    
    /** Resyncs the text content with the element */
    resync = () => {
        if (this.element) {
            this.element.innerText = this.text;
            if (!this.element.innerHTML.trim()) {
                this.element.innerHTML = '<br>';
            }
        }
    }
    
    /** @param {Number} offset */
    truncate = (offset) => {
        if (offset < 0 || offset > this.text.length) {
            throw new Error(`Offset ${offset} is out of bounds for text "${this.text}".`);
        }
        this.text = this.text.slice(0, offset);
        this.resync();
        this.refresh();
    }
    
    /** @param {Number} offset */
    split = (offset) => {
        if (offset < 0 || offset > this.text.length) {
            throw new Error(`Offset ${offset} is out of bounds for text "${this.text}".`);
        }
        const newText = this.text.slice(offset);
        this.text = this.text.slice(0, offset);
        this.resync();
        this.refresh();
        return this.codex && (newText ? new Text(this.codex, { text: newText, bold: this.bold, italic: this.italic, underline: this.underline, strikethrough: this.strikethrough, code: this.code }) : null);
    }
    
    /** @param {String} text @param {Number} offset */
    insert = (text, offset) => {
        if (offset < 0 || offset > this.text.length) {
            throw new Error(`Offset ${offset} is out of bounds for text "${this.text}".`);
        }
        this.text = this.text.slice(0, offset) + text + this.text.slice(offset);
        this.resync();
        this.refresh();
    }
    
    /** 
    * @param {Number} from @param {Number} to 
    * @returns {Boolean} Returns true if the block was deleted, false otherwise.
    */
    delete = (from, to) => {
        if (from === to) return false; // No-op if the range is empty
        if (from < 0 || to > this.text.length || from > to) {
            throw new Error(`Invalid range from ${from} to ${to} for text "${this.text}".`);
        }
        this.text = this.text.slice(0, from) + this.text.slice(to);
        if (!this.text.trim()) {
            // If the text is empty, we might want to remove the block
            if (this.parent && this.parent.children) {
                const index = this.parent.children.indexOf(this);
                if (index !== -1) {
                    this.parent.children.splice(index, 1);
                    return true;
                }
            }
            return false; // No need to resync or refresh if the block is removed
        }
        this.resync();
        this.refresh();
        return false; // Block was deleted
    }
    
    
    /** 
    * Focuses the text block at the specified start and end positions.
    * @param {Number} [start] - The start position of the focus.
    * @param {Number} [end] - The end position of the focus.
    * @param {Number} [attempts=0] - The number of attempts to focus the block.
    * If not provided, defaults to the start of the text block.
    */
    focus = (start, end, attempts) => requestAnimationFrame(() => {
        if (this.element) {
            const data = this.getFocusData(start, end);
            if (data) {
                this.codex?.selection?.setRange(data.startElement, data.startOffset, data.endElement, data.endOffset);
            } else {
                console.warn('Text focus data is not available yet.');
                return;
            }
        } else {
            console.warn('Text element is not available yet.');
            if (attempts === undefined) attempts = 0;
            if (attempts < 10) {
                this.focus(start, end, attempts + 1);
            } else {
                console.warn('Failed to focus text block after 10 attempts.');
            }
        }
    });
    
    
    /** @param {Number} [start] @param {Number} [end] */
    getFocusData = (start, end) => {
        start ??= 0;
        end ??= start;
        if (start < 0) start = this.text.length + start;
        if (end < 0) end = this.text.length + end;
        if (start > this.text.length || end > this.text.length || start < 0 || end < 0) {
            console.warn(`Invalid focus range: start=${start}, end=${end} for text "${this.text}".`);
            return;
        }
        if (this.element) {
            const text = this.element.firstChild;
            if (!text || !(text.nodeType === Node.TEXT_NODE)) {
                console.warn('Text element is not a text node or does not exist.');
                return;
            }
            return {
                startElement: text,
                endElement: text,
                startOffset: start,
                endOffset: end,
            };
        } else {
            console.warn('Text element is not available yet.');
            return;
        }
    }
}