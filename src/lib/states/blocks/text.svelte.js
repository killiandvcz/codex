import { untrack } from 'svelte';
import { Block } from '../block.svelte';
import { TextInputOperation } from './operations/text.ops';

/** 
* @typedef {Object} TextInit
* @property {String} [text] - Initial text content for the block.
* @property {Object} [link] - Link metadata for the text block.
* @property {String} [link.url] - The URL of the link.
* @property {String} [link.target] - The target attribute for the link (e.g., '_blank').
* @property {String} [link.title] - The title attribute for the link.
* @property {String} [link.rel] - The rel attribute for the link.
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
        
        this.link = init.link || null;
        
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
    ].join(''));
    
    selection = $derived.by(() => {
        
        if (this.selected) {
            const selection = this.codex?.selection;
            let startOffset = null;
            let endOffset = null;
            if (selection?.startBlock?.index < this.index) {
                startOffset = 0;
            } else if (selection?.startBlock?.index === this.index) {
                startOffset = selection?.startOffset ?? 0;
                this.log(`Selection start offset: ${startOffset} in text block at index ${this.index}`);
            }
            
            if (selection?.endBlock?.index > this.index) {
                endOffset = this.text.length;
            } else if (selection?.endBlock?.index === this.index) {
                endOffset = selection?.endOffset ?? this.text.length;
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
    
    /** @param {KeyboardEvent} e @param {Function} ascend */
    onkeydown = (e, ascend) => {
        if (e.key === 'Backspace' || e.key === 'Delete') {
            this.log('Backspace/Delete pressed in text block:', this);
            e.preventDefault();
            const parent = this.parent;
            const start = this.start;
            this.log(`Backspace/Delete pressed in text block at index ${this.index} with start ${start}`, this.codex?.selection.raw);
            if (this.selection && this.selection.length > 0) {
                this.delete(this.selection.start, this.selection.end);
                if (this.selection) this.focus(this.selection.start, this.selection.start);
                else parent?.focus(start);
            } else if (this.selection && this.selection.start === 0 && e.key === "Backspace") {
                if (this.before) {
                    this.before.delete(-2, -1);
                    this.before.focus(-1);
                }
            } else if (this.selection && this.selection.end === this.text.length && e.key === "Delete") {
                if (this.after) {
                    this.after.delete(0, 1);
                    this.after.focus(0);
                }
            } else if (this.selection) {
                this.delete(e.key === 'Backspace' ? this.selection.start - 1 : this.selection.start, e.key === 'Backspace' ? this.selection.start : this.selection.start + 1);
                if (this.selection) this.focus(e.key === 'Backspace' ? this.selection.start - 1 : this.selection.start, e.key === 'Backspace' ? this.selection.start - 1 : this.selection.start);
                else parent?.focus(start);
            }
        } else ascend()
    }
    
    /** @param {InputEvent} e */
    oninput = e => {
        this.refresh();
    }
    
    onfocus = () => {
        
    }
    
    
    /** @param {InputEvent} e */
    onbeforeinput = e => {
        console.warn('Text beforeinput', e);
        if (e.inputType === 'insertText' && e.data) {
            const operation = new TextInputOperation(this, e.data, this.selection?.start || 0);
            this.codex?.history?.add(operation);
        }
        // e.preventDefault();
    }
    
    /** Refreshes the text content from the element */
    refresh = () => {
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
            return null; // No split if offset is out of bounds
        }
        if (offset === 0 || offset === this.text.length) {
            return null;
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
        if (from < 0) from = this.text.length + (from + 1);
        if (to < 0) to = this.text.length + (to + 1);
        if (to > this.text.length) to = this.text.length;
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
    
    
    /** Merges this text block with another text block.
    * @param {Text} textBlock - The text block to merge with.
    * @throws {Error} If the provided block is not a Text instance.
    */
    merge = (textBlock) => {
        if (!(textBlock instanceof Text)) {
            throw new Error(`Cannot merge with non-text block: ${textBlock}`);
        }
        const end = this.text.length;
        this.text += textBlock.text;
        this.resync();
        this.refresh();
        textBlock.delete(0, -1);
        this.focus(end, end);
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
        if (start < 0) start = this.text.length + (start + 1);
        if (end < 0) end = this.text.length + (end + 1);
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