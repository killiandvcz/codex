import { Block, MegaBlock } from "../block.svelte";
import { Linebreak } from "./linebreak.svelte";
import { Text } from "./text.svelte";
import { paragraphStrategies } from "./strategies/paragraph.strategies";
import { Focus } from "$lib/values/focus.values";
import { ParagraphBlockInsertion } from "./operations/paragraph.ops";
import { BlocksInsertion, BlocksRemoval } from "./operations/block.ops";
import { SMART, Operation } from "$lib/utils/operations.utils";
import { EDITABLE, MERGEABLE } from "$lib/utils/capabilities";

/** 
* @typedef {(import('./text.svelte').TextObject|import('./linebreak.svelte').LinebreakObject)[]} ParagraphContent
*/

/**
* @typedef {import('../block.svelte').BlockObject & {
*  type: 'paragraph',
*  children: ParagraphContent
* }} ParagraphObject
*/


/**
 * @typedef {import("../block.svelte").BlockInit & {
 *  children?: ParagraphContent
 * }} ParagraphInit
 */

/**
 * @typedef {import('./text.svelte').TextInit|import('./linebreak.svelte').LinebreakInit} ParagraphChildInit
 * @typedef {ParagraphChildInit[]} ParagraphChildrenInit
 */


/**
 * @extends {MegaBlock<Text|Linebreak>}
 */
export class Paragraph extends MegaBlock {
    /** @type {import("../block.svelte").MegaBlockManifest} */
    static manifest = {
        type: 'paragraph',
        blocks: {
            linebreak: Linebreak,
            text: Text,
        },
        strategies: paragraphStrategies,
        capabilities: [ MERGEABLE ]
    }

    /**
    * @param {import('../codex.svelte').Codex} codex
    * @param {ParagraphInit} [init]
    */
    constructor(codex, init = {}) {
        super(codex, {
            id: init.id,
            metadata: init.metadata,
        });

        if (init.children?.length) {
            this.children = init.children.map((b) => {
                const { type, init = {} } = b;
                this.log('Creating child block of type:', b);

                const B = this.blocks[type];
                if (!B) throw new Error(`Block type "${type}" not found in paragraph.`);
                return new B(this.codex, init);
            }).filter(b => b instanceof Linebreak || b instanceof Text);
        }

        $effect.root(() => {
            $effect(() => {
                if (this.codex && this.element) {
                    const lastChild = this.children[this.children.length - 1];
                    if (!lastChild ) {
                        const tx = this.codex?.tx([
                            new ParagraphBlockInsertion(this, {
                                blocks: [
                                    {
                                        type: 'linebreak',
                                        init: {}
                                    }
                                ],
                                offset: -1
                            })
                        ]);
                        tx?.execute();
                    }
                }
            })
            
            $effect(() => {
                if (this.element && this.children) {
                    const styles = this.children.map(child => child instanceof Text ? child.style : null).filter(style => style);
                    if (styles) this.normalize();
                }
            })

            $effect(() => {
                if (this.element && this.children) {
                    const empties = this.children.filter(child => child instanceof Text && !child.text);
                    if (empties.length === 0) return;
                    const ops = [ new BlocksRemoval(this, {ids: empties.map(empty => empty.id)}) ];
                    const selection = this.selection;
                    this.codex?.effect(ops);
                    this.log({selection});
                    if (selection.isInParagraph) this.focus(new Focus(selection.startOffset, selection.endOffset));
                }
            })

            $inspect(this.children).with(console.trace);
        });

        this.preparator('merge', this.prepareMerge.bind(this));
    }
    
    /** @type {HTMLParagraphElement?} */
    element = $state(null);
    
    selection = $derived.by(() => {
        const firstChild = this.children.find(child => child.selected);
        const lastChild = this.children.findLast(child => child.selected);

        const firstOffset = firstChild && firstChild.start + (firstChild instanceof Text ? firstChild.selection?.start : 0);
        const lastOffset = lastChild && lastChild.start + (lastChild instanceof Text ? lastChild.selection?.end : 1);

        return {
            startOffset: firstOffset,
            endOffset: lastOffset,
            isCollapsed: this.codex?.selection.collapsed,
            isInParagraph: !!firstChild
        };
    });
    
    /** @type {Number} */
    length = $derived(this.children.reduce((acc, child) => {
        return acc + (child instanceof Text ? child.text.length : 1);
    }, 0));
    
    /** @type {Number} */
    start = $derived(this.before ? (this.before?.end ?? 0) + 1 : 0);
    
    /** @type {Number} */
    end = $derived(this.start + this.length);


    /** @type {import('$lib/utils/block.utils').BlockListener<InputEvent>} */
    onbeforeinput = e => {
        if (e.inputType === 'insertText' && e.data) {
            const selection = this.selection;
            if (this.selection.isCollapsed && this.children.find(child => child.selected) instanceof Linebreak) {
                const selected = this.children.find(c => c.selected);
                const index = this.children.findIndex(c => c === selected);
                const tx = this.codex?.tx([
                    new ParagraphBlockInsertion(this, {
                        blocks: [
                            {
                                type: 'text',
                                init: {
                                    text: e.data
                                },
                            }
                        ],
                        offset: index
                    })
                ]);
                tx?.execute().then(r => {
                    console.log('Insertion result:', r);
                    this.focus(new Focus(selection.startOffset + 1, selection.startOffset + 1));

                });
            }
        }
    }
    
    /** @type {import('$lib/utils/block.utils').BlockListener<KeyboardEvent>} */
    onkeydown = (e, ascend, data) => {
        if (!this.codex) return;
        const selected = this.children?.filter(c => c.selected);
        const first = selected[0];
        const last = selected[selected.length - 1];
        const selection = this.selection;

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.codex?.tx(this.prepareSplit()).execute().then(ops => {
                this.log(ops);
                const op = ops?.find(o => o.operation.metadata?.key === 'new-paragraph');
                const newParagraph = op?.result?.[0];
                if (newParagraph) {
                    newParagraph.focus(new Focus(0, 0));
                } else {
                    console.error('No new paragraph found in operations:', ops);
                }
            })
            return;
        }

        if (e.key === 'Backspace' && selection.isCollapsed && selection.startOffset === 0) {
            e.preventDefault();

            /** @type {Paragraph|null} */
            const previousMergeable = this.codex.recursive.findLast(b => b.capabilities.has(MERGEABLE) && b.index < this.index);
            this.log('Merging with previous mergeable block:', previousMergeable);

            const obj = this.toInit();
            this.log('Current paragraph init for merge:', obj);
            if (previousMergeable && previousMergeable !== this) {
                previousMergeable.merge(this)?.then(() => {
                    console.log('Merged paragraph into previous block:', previousMergeable);
                })
            }

            

            return;
        }

        if (data) {
            if (data?.action === 'delete') {
                /** @type {{block: Text, key: String}} */
                const {block, key = e.key} = data;
                if (block) {
                    const selection = this.selection;
                    e.preventDefault();
                    this.codex.tx([
                        ...this.prepareRemove({ ids: [block.id] }),
                    ]).execute();
                    const offset = key === 'Backspace' ? selection.startOffset - 1 : selection.startOffset;
                    this.log('Deleting block:', block.id);
                    this.focus(new Focus(offset, offset));
                    return;
                }
            } else if (data?.action === 'split') {
                /** @type {import("./text.svelte").SplitData} */
                const {block, editData, newTextData} = data;
                if (block) {
                    const blockIndex = this.children.findIndex(c => c === block);
                    const ops = [];
                    if (e.shiftKey) {
                        const offset = this.selection.startOffset;
                        if (editData) ops.push(...block.prepareEdit(editData));
                        ops.push(...this.prepareInsert({
                            block: {type: 'linebreak'},
                            offset: blockIndex + 1
                        }));
                        if (newTextData) ops.push(...this.prepareInsert({
                            block: {type: 'text', init: {
                                text: newTextData.text,
                                ...newTextData.styles
                            }},
                            offset: blockIndex + 2
                        }));
                        this.codex.tx(ops).execute();
                        this.focus(new Focus(offset + 1, offset + 1));
                    }
                }
                return;
            } else if (data?.action === 'nibble') {
                /** @type {{block: Text, what: 'previous'|'next'}} */
                const {block, what} = data;
                if (block) {
                    const offset = what === 'previous' ? block.start - 1 : block.end;
                    const blockIndex = this.children.findIndex(c => c === block);
                    const target = what === 'previous' ? this.children[blockIndex - 1] : this.children[blockIndex + 1];
                    const ops = [];
                    if (!target) return;
                    if (target instanceof Linebreak) ops.push(...this.prepareRemove({ ids: [target.id] }));
                    else if (target instanceof Text) ops.push(...target.prepareEdit({
                        from: -2,
                        to: -1
                    }));
                    this.codex.tx(ops).execute();
                    this.focus(new Focus(offset, offset));

                }

            }
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                const ops = [];
                const offset = first && first.start + (first instanceof Text ? first.selection?.start : 0);
                if (first === last) {
                    const index = this.children.findIndex(c => c === first);
                    if (first instanceof Text) {
                        const data = first.getSplittingData(SMART);
                        this.log('Splitting data:', data);

                        if (data) {
                            ops.push(...first.prepareEdit({
                                from: first.selection?.start || 0,
                                to: first.text.length
                            }));
                            ops.push(...this.prepareInsert({
                                block: {
                                    type: 'linebreak'
                                },
                                offset: index + 1
                            }));
                            if (data.after) {
                                ops.push(...this.prepareInsert({
                                    block: {
                                        type: 'text',
                                        init: data.after
                                    },
                                    offset: index + 2
                                }));
                            }
                        }
                    } else if (first instanceof Linebreak) {
                        ops.push(...this.prepareInsert({
                            block: {
                                type: 'linebreak'
                            },
                            offset: index + 1
                        }));
                    }
                }

                this.codex?.tx(ops).execute().then(r => {
                    this.focus(new Focus(offset + 1, offset + 1));
                });
            }
        }
    }
    
    normalize = () => {
        if (!this.codex) return;

        /** @type {Number[][]} */
        const groups = findConsecutiveTextGroupsByStyle(this.children);

        if (groups.length) {
            this.log('Found groups of consecutive texts with same style:', groups);
            /** @type {Operation[]} */
            const ops = [];
            groups.forEach(group => {
                const texts = group.map(i => this.children[i]).filter(c => c instanceof Text);
                if (texts.length < 2) return;
                const first = texts[0];
                const merging = texts.slice(1).reduce((acc, t) => acc + t.text, "");
                ops.push(...first.prepareEdit({
                    from: -1,
                    to: -1,
                    text: merging
                }));
                ops.push(...this.prepareRemove({ ids: texts.slice(1).map(t => t.id) }));
            });
            const selection = this.selection;
            this.codex.effect(ops);

            this.log({selection});
            // if (selection.isInParagraph) this.focus(new Focus(selection.startOffset, selection.endOffset));
        }

        if (this.children.length === 0) {
            this.children = [new Linebreak(this.codex)];
        }

        if (!(this.children.at(-1) instanceof Linebreak)) {
            this.children.push(new Linebreak(this.codex));
        }
    }

    /** @param {Focus} f @param {Number} attempts */
    focus = (f, attempts = 0) => requestAnimationFrame(() => {
        this.log('Focusing paragraph:', this.index, 'with focus:', f);
        if (this.element) {
            const data = this.getFocusData(f);
            if (data) this.codex?.selection?.setRange(data.startElement, data.startOffset, data.endElement, data.endOffset);
            else console.warn('Could not get focus data for paragraph:', this);
        } else {
            attempts ??= 0;
            if (attempts < 10) this.focus(f, attempts + 1);
            else console.error(`Failed to focus paragraph ${this.index} after 10 attempts.`);
        }
    });

    /**
     * @param {Focus} f
     * @returns
     */
    getFocusData = (f) => {
        let { start, end } = f;
        start ??= 0;
        end ??= start;
        if (start && start < 0) start = this.end + (start + 1);
        if (end && end < 0) end = this.end + (end + 1);
        
        
        if (start < 0 || end < 0 || start > this.end || end > this.end) {
            console.warn(`Invalid focus range: start=${start}, end=${end} for paragraph ${this.index}. Resetting to 0.`);
            start = 0;
            end = 0;
        }
        
        let startBlock = this.children.find(child => start >= child.start && start <= child.end)
        let endBlock = this.children.find(child => end >= child.start && end <= child.end);
        if (start === end && startBlock instanceof Linebreak && start === startBlock.end && this.children.find(child => child.start === start)) startBlock = endBlock = this.children.find(child => child.start === start);

        this.log(`Focus data for paragraph ${this.index}: start=${start}, end=${end}`, startBlock, endBlock);

        const startData = startBlock ? startBlock.getFocusData(new Focus(start - startBlock.start, start - startBlock.start)) : null;
        const endData = endBlock ? endBlock.getFocusData(new Focus(end - endBlock.start, end - endBlock.start)) : null;

        if (startData && endData) {
            return {
                startElement: startData.startElement,
                startOffset: startData.startOffset,
                endElement: endData.endElement,
                endOffset: endData.endOffset,
            };
        } else {
            console.warn('Could not get focus data for blocks:', startBlock, endBlock);
            return null;
        }
    }

    debug = $derived(`${this.selection.startOffset} - ${this.selection.endOffset} [length: ${this.length}]`);

    /**
     * Merges the paragraph with the given data.
     * @param {import('$lib/states/block.svelte').Block} source 
     * @returns 
     */
    merge = source => {
        if (!this.codex) return;
        const offset = (this.end - this.start) - 1;
        this.log('Focusing at offset after merge:', offset);
        return this.codex.tx(this.prepareMerge(source)).execute().then(() => {
            this.focus(new Focus(offset, offset));
        })
    }
    /** @param {import('$lib/states/block.svelte').Block} source */
    prepareMerge = source => {
        const ops = [];
        const children = source?.toInit?.().init?.children || [];

        if (children?.length) {
            ops.push(...this.prepareInsert({
                blocks: children,
                offset: -2
            }));
        } 

        if (source) ops.push(...source.prepareDestroy());

        return ops || [];
    }

    /**
     * Splits the paragraph at the given offsets.
     * @param {{start?: number, end?: number, offset?: number} | SMART} [data=SMART]
     * @return {Operation[]}
     */
    prepareSplit = data => {
        if (!this.codex) return [];
        if (!data) data = SMART;
        if (data === SMART) (data = { start: this.selection.startOffset || 0, end: this.selection.endOffset || this.selection.startOffset || 0 });
        else if (data?.offset && (data.start || data.end)) throw new Error('Cannot specify both offset and start/end for split operation.');
        else if (data?.offset) data = { start: data.offset, end: data.offset };
        else if (!data?.start && !data?.end) data = { start: 0, end: 0 };
        const { start = 0, end = 0 } = data;


        const startBlock = this.children.find(child => start >= child.start && start <= child.end);
        const endBlock = this.children.find(child => end >= child.start && end <= child.end);
        const middleBlocks = this.children.slice(this.children.indexOf(startBlock) + 1, this.children.indexOf(endBlock));
        const afterBlocks = this.children.slice(this.children.indexOf(endBlock) + 1).filter(b => !(b instanceof Linebreak && this.children.at(-1) === b))
        this.log('Preparing split of paragraph:', this.index, 'at', {start, end}, 'with blocks:', startBlock, middleBlocks, endBlock, afterBlocks);

        const ops = [];

        const startSplittingData = startBlock instanceof Text ? startBlock.getSplittingData() : null;
        const endSplittingData = endBlock instanceof Text ? endBlock.getSplittingData() : null;
        this.log('Splitting data:', {startSplittingData, endSplittingData});
        if (startBlock instanceof Text) ops.push(...startBlock.prepareEdit({
            from: startSplittingData?.from || 0,
            to: startBlock.text.length
        }))
        if (afterBlocks.length) ops.push(...this.prepareRemove({ ids: afterBlocks.map(b => b.id) }));

        // /** @type {ParagraphInit} */
        const newParagraphInit = {
            type: 'paragraph',
            init: {
                children: [
                    ...(endSplittingData?.after ? [{type: 'text', init: endSplittingData.after}] : []),
                    ...(afterBlocks.length ? afterBlocks.map(c => c.toInit?.()) : []),
                ]
            }   
        }

        const index = this.codex.children.indexOf(this);

        const insertion = this.parent?.prepare('insert', {
            block: newParagraphInit,
            offset: index + 1
        }, {key: 'new-paragraph'});
        this.log('Insertion op for new paragraph:', insertion);
        if (insertion) ops.push(...insertion);

        this.log('New paragraph init:', newParagraphInit);

        

        this.log('Operations for split:', ops);
        return ops;
    }

    /**
     * @param {(import('$lib/states/blocks/operations/block.ops').BlocksRemovalData & {
     *  id?: String
     * })|import('$lib/utils/operations.utils').SMART} data 
     * @returns {import('$lib/utils/operations.utils').Operation[]}
     */
    prepareRemove(data = SMART) {
        if (!(data === SMART)) return super.prepareRemove(data);
        
        /** @type {import('$lib/utils/operations.utils').Operation[]} */
        const ops = [];

        console.log(this);
        if (this.parent) {
            const startBlock = this.children.find(child => child.selected);
            const endBlock = this.children.findLast(child => child.selected && child !== startBlock);
            const betweenBlocks = (startBlock && endBlock) && this.children.slice(this.children.indexOf(startBlock) + 1, this.children.indexOf(endBlock)) || [];

            if (endBlock?.capabilities.has(EDITABLE) && endBlock !== startBlock) ops.push(...endBlock.prepare('edit', null, {key: 'clear-selection'})); else ops.push(...((endBlock && !(endBlock instanceof Linebreak && this.children.at(-1) === endBlock)) ? this.prepareRemove({ id: endBlock.id }) : []));

            if (betweenBlocks.length) ops.push(...this.prepareRemove({
                ids: betweenBlocks.filter(b => !(b instanceof Linebreak && this.children.at(-1) === b)).map(b => b.id)
            }));

            if (startBlock?.capabilities.has(EDITABLE)) ops.push(...startBlock.prepare('edit', null, {key: 'clear-selection'})); else ops.push(...(startBlock ? this.prepareRemove({ id: startBlock.id }) : []));
        } 

        return ops;
    }


    toObject() {
        return {
            ...super.toObject(),
            children: this.children.map(child => child.toObject()),
        }
    }

    toInit() {
        return {
            ...super.toInit(),
            init: {
                children: this.children.filter(child => !(child instanceof Linebreak && this.children.at(-1) === child)).map(child => child.toInit()),
            }
        }
    }

    getRelativePosition() {
        return {
            start: this.selection.startOffset,
            end: this.selection.endOffset
        }
    }

    /**
     * @param {{start: number, end: number}} hint 
     */
    toDOM(hint) {
        let { start, end } = hint;
        this.log('Converting to DOM with hint:', hint);
        if (start < 0) start = 0;
        if (end > this.length) end = this.length;
        const data = this.getFocusData(new Focus(start, end));
        this.log(data);
        return {
            start: {
                node: data?.startElement || this.element,
                offset: data?.startOffset || 0
            },
            end: {
                node: data?.endElement || this.element,
                offset: data?.endOffset || 0
            }
        };

    }
}


/**
 * Finds consecutive text elements with the same style.
 * @param {(Text|Linebreak)[]} elements 
 * @returns {Number[][]} - Array of arrays, each containing the indices of consecutive Text elements with the same style.
 */
function findConsecutiveTextGroupsByStyle(elements) {
    const groups = [];
    let currentGroup = [];
    let currentStyle = null;
    
    for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        
        // Si c'est un Text
        if (element instanceof Text) {
            const elementStyle = element.style;
            
            // Si c'est le premier Text ou si le style est différent du précédent
            if (currentStyle === null || elementStyle !== currentStyle) {
                // Sauvegarder le groupe précédent s'il contient au moins 2 éléments
                if (currentGroup.length >= 2) {
                    groups.push([...currentGroup]);
                }
                
                // Commencer un nouveau groupe
                currentGroup = [i];
                currentStyle = elementStyle;
            }
            // Si le style est le même que le précédent
            else if (elementStyle === currentStyle) {
                currentGroup.push(i);
            }
        }
        // Si c'est un Linebreak ou autre chose
        else {
            // Sauvegarder le groupe actuel s'il contient au moins 2 éléments
            if (currentGroup.length >= 2) {
                groups.push([...currentGroup]);
            }
            
            // Réinitialiser pour le prochain groupe
            currentGroup = [];
            currentStyle = null;
        }
    }
    
    // Ne pas oublier le dernier groupe
    if (currentGroup.length >= 2) {
        groups.push(currentGroup);
    }
    
    return groups;
}