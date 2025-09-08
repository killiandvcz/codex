import { untrack } from 'svelte';
import { Block } from '../block.svelte';
import { TextDeleteOperation, TextEdition, TextInsertOperation } from './operations/text.ops';
import { Focus } from '$lib/values/focus.values';
import { executor, SMART, Transaction } from '$lib/utils/operations.utils';

/**
* @typedef {import('../block.svelte').BlockInit & {
*   text?: String
* } & Styles} TextInit
*/

/**
* @typedef {import('../block.svelte').BlockInit & {type: 'text', init: TextInit}} TextObject
*/

/**
 * @typedef {{
 *  bold?: Boolean,
 *  italic?: Boolean,
 *  underline?: Boolean,
 *  strikethrough?: Boolean,
 *  code?: Boolean
 * }} Styles
 */

/**
* @extends {Block}
*/
export class Text extends Block {
    /** @type {import('../block.svelte').BlockManifest} */
    static manifest = {
        type: 'text',
    }
    
    /** 
    * @param {import('../codex.svelte').Codex} codex
    * @param {TextInit} init */
    constructor(codex, init = {}) {
        super(codex, {
            id: init.id,
            metadata: init.metadata || {}
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
                        this.element.textContent = this.text;
                    }
                })
            })
        });
        
        this.method('insert', this.handleInsert);
        this.method('delete', this.handleDelete);

        this.trine("edit", this.prepareEdit, this.edit, this.applyEdit);
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
            if (!textnode) return;
            try {
                if (range.comparePoint(textnode, 0) >= 0) {
                    localrange.setStart(textnode, 0);
                }
                if (range.comparePoint(textnode, this.text.length) <= 0) {
                    localrange.setEnd(textnode, this.text.length);
                }
            } catch (e) {
                console.error(e, textnode);
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
    
    /** @type {import('$lib/utils/block.utils').BlockListener<KeyboardEvent>} */
    onkeydown = (e, ascend) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            return ascend({
                block: this,
                action: 'split',
                editData: this.selection?.start !== this.text.length ? {
                    from: this.selection?.start,
                    to: this.text.length
                } : undefined,
                newTextData: this.text.slice(this.selection?.end || 0) ? {
                    text: this.text.slice(this.selection?.end || 0),
                    styles: this.getStyles()
                } : undefined
            })
        }
        if (e.key !== 'Backspace' && e.key !== 'Delete') return ascend();
        
        e.preventDefault();
        
        if (!this.selection) return;
        
        const isBackspace = e.key === 'Backspace';
        const { start, end } = this.selection;
        if (this.selection.length > 0) {
            if (this.selection.length === this.text.length) {
                return ascend({
                    action: 'delete',
                    block: this,
                });
            }
            this.edit({ from: start, to: end });
            this.focus(new Focus(start, start));
        } else if ((isBackspace && start === 0) || (!isBackspace && end === this.text.length)) {
            return ascend({
                action: 'merge',
                block: this,
                with: isBackspace ? 'previous' : 'next'
            });
        } else if ((isBackspace && start === 1 && this.text.length === 1) || (!isBackspace && start === 0 && this.text.length === 1)) {
            return ascend({
                action: 'delete',
                block: this,
                key: isBackspace ? 'Backspace' : 'Delete'
            });
        } else {
            const from = isBackspace ? start - 1 : start;
            const to = isBackspace ? start : start + 1;
            const length = to - from;
            this.log(`Deleting ${length} character(s) from ${from} to ${to}. Remains ${this.text.length} character(s).`);

            this.edit({
                from,
                to
            })
            this.focus(new Focus(from, from))
        }
    }
    
    executeDelete = (from, to, focusPosition) => {
        const tx = this.codex?.tx([
            new TextDeleteOperation(this, { from, to })
        ]);
        tx?.execute();
        
        const focusTarget = this.selection ? this : this.parent;
        focusTarget?.focus(new Focus(focusPosition, focusPosition));
    }
    
    /** @type {import('$lib/utils/block.utils').BlockListener<InputEvent>} */
    oninput = e => {
        this.refresh();
    }
    
    onfocus = () => {
        
    }
    
    
    /** @type {import('$lib/utils/block.utils').BlockListener<InputEvent>} */
    onbeforeinput = e => {
        if (e.inputType === 'insertText' && e.data) {
            let {start, end} = this.selection || {};
            this.log('Inserting text:', e.data, 'at', start, 'to', end);
            start ??= this.text.length;
            this.edit({
                text: e.data,
                from: start,
                to: end
            });
            e.preventDefault();
            this.focus(new Focus((start ?? this.text.length) + e.data.length, (start ?? this.text.length) + e.data.length));
        }
    }
    
    /** Refreshes the text content from the element */
    refresh = () => {
        if (this.element) this.text = this.element.textContent;
        else this.text = '';
    }
    
    /** Resyncs the text content with the element */
    resync = () => {
        if (this.element) {
            this.element.textContent = this.text;
            // if (!this.element.textContent.trim()) {
            //     this.element.textContent = '';
            // }
        }
    }
    
    /** @param {Number} offset */
    split = (offset) => {
        const remainder = this.text.slice(offset);
        if (!remainder) return;

        const op = new TextDeleteOperation(this, {
            from: offset,
            to: this.text.length
        });
        
        return {
            operation: op,
            remainder: {
                type: 'text',
                data: {
                    text: remainder,
                    bold: this.bold,
                    italic: this.italic,
                    underline: this.underline,
                    strikethrough: this.strikethrough,
                    code: this.code
                }
            }
        }
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
            if (data) {
                this.codex?.selection?.setRange(data.startElement, data.startOffset, data.endElement, data.endOffset);
                return true;
            }
            else return console.warn('Text focus data is not available yet.');
        } else {
            attempts ??= 0;
            if (attempts < 10) return this.focus(f, attempts + 1);
            else return console.warn('Failed to focus text block after 10 attempts.');
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
            init: {
                text: this.text,
                ...this.getStyles()
            }
        };
    }
    
    toMarkdown() {
        
    }
    
    // COMMANDS :
    
    
    /** @param {Number} offset */
    $split = (offset) => {
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
    $insert = (text, offset) => {
        if (offset < 0 || offset > this.text.length) {
            throw new Error(`Offset ${offset} is out of bounds for text "${this.text}".`);
        }
        this.text = this.text.slice(0, offset) + text + this.text.slice(offset);
        this.resync();
        this.refresh();
    }
    
    /** 
    * Deletes a range of text from the block.
    * @param {Number} from @param {Number} to 
    * @returns {Boolean} Returns true if the block was deleted, false otherwise.
    */
    $delete = (from, to) => {
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
    
    
    
    /**
    * @param {{
    *   text: string,
    *   offset: number
    * }} data 
    */
    applyInsert = data => {
        const { text, offset } = data;
        if (offset < 0 || offset > this.text.length) {
            throw new Error(`Offset ${offset} is out of bounds for text "${this.text}".`);
        }
        this.text = this.text.slice(0, offset) + text + this.text.slice(offset);
        this.resync();
        this.refresh();
    }

    getStyles = () => ({
        bold: this.bold,
        italic: this.italic,
        underline: this.underline,
        strikethrough: this.strikethrough,
        code: this.code
    });

    /** @param {Number} index */
    normalizeIndex = (index) => {
        if (index < 0) index = this.text.length + index + 1;
        return Math.max(0, Math.min(index, this.text.length));
    }

    /** @param {EditData|import('$lib/utils/operations.utils').SMART} data  */
    normalizeEditParams = (data) => {
        const isSmartMode = data === SMART;
        
        let { text = "", from, to } = isSmartMode 
        ? { from: this.selection?.start, to: this.selection?.end }
        : data;
        
        // Validation
        if (from === undefined && from !== 0) {
            throw new Error('From is required for text edit.');
        }
        
        // Normalisation des indices
        from = this.normalizeIndex(from);
        to = to !== undefined ? this.normalizeIndex(to) : from;
        
        // Assurer from <= to
        if (to < from) to = from;
        
        return { text, from, to };
    }


    /**
    * @param {{
    *   from: number,
    *   to: number
    * }|import('$lib/utils/operations.utils').SMART} data
    */
    getSplittingData = (data) => {
        const { from, to } = this.normalizeEditParams(data);
        
        return {
            before: from > 0 ? {
                text: this.text.slice(0, from),
                ...this.getStyles()
            } : null,
            
            removed: from < to ? {
                text: this.text.slice(from, to),
                ...this.getStyles()
            } : null,
            
            after: to < this.text.length ? {
                text: this.text.slice(to),
                ...this.getStyles()
            } : null,
        };
    }

    /** @param {EditData|import('$lib/utils/operations.utils').SMART} data  */
    prepareEdit = data => {
        const params = this.normalizeEditParams(data);
        
        return [
            new TextEdition(this, params)
        ];
    }

    /** @type {import('$lib/utils/operations.utils').Executor<EditData>} */
    edit = executor(this, data => this.prepareEdit(data));

    /** @param {EditData} data  */
    applyEdit = data => {
        
        let {text = "", from, to} = data;
        to = to ?? from;
        this.log('APPLY EDIT', { from, to, text }, 'TO', this.text);
        this.text = this.text.slice(0, from) + text + this.text.slice(to);
        this.resync();
        this.refresh();
    }
}


/**
* @typedef {{
*   text?: string,
*   from: number,
*   to?: number
* }} EditData
*/


/**
 * @typedef {{
 *  block: Text,
 *  action: 'split',
 *  editData: {
 *    from: number,
 *    to: number
 *  },
 *  newTextData: {
 *    text: string,
 *    styles: Styles
 *  } | undefined
 * }} SplitData
 */

/**
 * @typedef {SplitData} TextActionsData
 */