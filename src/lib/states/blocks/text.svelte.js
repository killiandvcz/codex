import { untrack } from 'svelte';
import { Block } from '../block.svelte';
import { TextDeleteOperation, TextInsertOperation } from './operations/text.ops';
import { Focus } from '$lib/values/focus.values';
import { Transaction } from '$lib/utils/operations.utils';

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

        this.method('insert', this.handleInsert);
        this.method('delete', this.handleDelete);
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
        const range = this.codex?.selection.range;
        if (this.selected && range && this.element) {
            const localrange = range.cloneRange();
            const textnode = this.element.childNodes[0];
            try {
                if (range.comparePoint(textnode, 0) >= 0) {
                    localrange.setStart(textnode, 0);
                }
                if (range.comparePoint(textnode, this.text.length) <= 0) {
                    localrange.setEnd(textnode, this.text.length);
                }
            } catch (e) {
                console.error(e);
            }
            const startOffset = localrange.startOffset;
            const endOffset = localrange.endOffset;

            return {
                start: startOffset,
                end: endOffset,
                length: endOffset - startOffset
            };
        }
    })
    
    selectionDebug = $derived(`${this.selection ? `Selection: ${this.selection.start} - ${this.selection.end} (${this.selection.length})` : 'No selection'}`);
    
    /** @param {KeyboardEvent} e @param {Function} ascend */
    onkeydown = (e, ascend) => {
        if (e.key !== 'Backspace' && e.key !== 'Delete') return ascend();

        e.preventDefault();
        
        if (!this.selection) return;

        const isBackspace = e.key === 'Backspace';
        const { start, end } = this.selection;

        if (this.selection.length > 0) {
            this.executeDelete(start, end, start);
            return;
        }

        if ((isBackspace && start === 0) || (!isBackspace && end === this.text.length)) {
            return ascend();
        }

        const from = isBackspace ? start - 1 : start;
        const to = isBackspace ? start : start + 1;
        this.executeDelete(from, to, from);
    }

    executeDelete = (from, to, focusPosition) => {
        const tx = this.codex?.tx([
            new TextDeleteOperation(this, { from, to })
        ]);
        tx?.execute();
        
        const focusTarget = this.selection ? this : this.parent;
        focusTarget?.focus(new Focus(focusPosition, focusPosition));
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
            const deletion = this.selection && this.selection.length > 0;
            const {start, end} = this.selection || {};
            const tx = new Transaction([
                ...(deletion ? [new TextDeleteOperation(this, {
                    from: start,
                    to: end
                })] : []),
                new TextInsertOperation(this, {
                    text: e.data,
                    offset: this.selection ? this.selection.start : this.text.length
                })
            ]); 
            this.codex?.history?.add(tx);
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
        return false;
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

    /**
     * @param {import('./operations/text.ops').TextDeleteOperationData} data 
     */
    handleDelete = (data) => {
        const { from, to } = data;
        this.delete(from, to);
    }

    /**
     * @param {import('./operations/text.ops').TextInsertOperation} data 
     */
    handleInsert = (data) => {
        const { text, offset } = data;
        this.insert(text, offset);
    }
}