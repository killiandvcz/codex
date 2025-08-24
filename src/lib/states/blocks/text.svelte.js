import { untrack } from 'svelte';
import { Block } from '../block.svelte';
import { TextInputOperation } from './operations/text.ops';
import { Focus } from '$lib/values/focus.values';

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

/**
 * @typedef {import('../block.svelte').BlockObject & TextInit & {type: 'text'}} TextObject
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
    start = $derived(this.before ? (this.before.end ?? 0) : 0);
    /** @type {Number} */
    end = $derived(this.start + (this.text.length || 0));
    
    debug = $derived(`${this.text} (${this.selection?.start}->${this.selection?.end})`);
    
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
            e.preventDefault();
            const parent = this.parent;
            const start = this.start;
            const end = this.end;
            if (this.selection && this.selection.length > 0) {
                this.delete(this.selection.start, this.selection.end);
                if (this.selection) this.focus(new Focus(this.selection.start, this.selection.start));
                else parent?.focus(new Focus(start, start));
            } else if (this.selection && this.selection.start === 0 && e.key === "Backspace") {
                ascend();
            } else if (this.selection && this.selection.end === this.text.length && e.key === "Delete") {
                ascend();
            } else if (this.selection) {
                this.delete(e.key === 'Backspace' ? this.selection.start - 1 : this.selection.start, e.key === 'Backspace' ? this.selection.start : this.selection.start + 1);
                if (this.selection) this.focus(new Focus(e.key === 'Backspace' ? this.selection.start - 1 : this.selection.start, e.key === 'Backspace' ? this.selection.start - 1 : this.selection.start));
                else parent?.focus(new Focus(start, start));
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
        this.log('DELETE', { from, to });
        if (from === to) return false; // No-op if the range is empty
        if (from < 0) from = this.text.length + (from + 1);
        if (to < 0) to = this.text.length + (to + 1);
        if (to > this.text.length) to = this.text.length;
        if (from < 0 || to > this.text.length || from > to) throw new Error(`Invalid range from ${from} to ${to} for text "${this.text}".`);
        this.text = this.text.slice(0, from) + this.text.slice(to);
        if (!this.text.trim()) { return this.rm() };
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
        // this.focus(new Focus(end, end));
    }

    /**
     * @param {Focus} f 
     * @param {Number} [attempts=0]
     * @returns
     */
    focus = (f, attempts) => requestAnimationFrame(() => {
        if (this.element) {
            const data = this.getFocusData(f);
            if (data) this.codex?.selection?.setRange(data.startElement, data.startOffset, data.endElement, data.endOffset)
            else console.warn('Text focus data is not available yet.');
        } else {
            attempts ??= 0;
            if (attempts < 10) this.focus(f, attempts + 1)
            else console.warn('Failed to focus text block after 10 attempts.');
        }
    })

    /**
     * @param {Focus} f
     * @returns
     */
    getFocusData = (f) => {
        let { start, end } = f;
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


    /** @returns {TextObject} */
    toJSON() {
        return {
            ...super.toJSON(),
            type: 'text',
            text: this.text,
            ...(this.link ? { link: this.link } : {}),
            ...(this.bold ? { bold: this.bold } : {}),
            ...(this.italic ? { italic: this.italic } : {}),
            ...(this.underline ? { underline: this.underline } : {}),
            ...(this.strikethrough ? { strikethrough: this.strikethrough } : {}),
            ...(this.code ? { code: this.code } : {}),
        };
    }


    toMarkdown() {

    }
}