import { MegaBlock } from "../block.svelte";
import { Linebreak } from "./linebreak.svelte";
import { Text } from "./text.svelte";
import { paragraphStrategies } from "./strategies/paragraph.strategies";
import { MERGEABLE, MergeData } from "../capabilities/merge.capability";
import { Focus } from "$lib/values/focus.values";
import { ParagraphBlockInsertion } from "./operations/paragraph.ops";
import { BlocksRemoval } from "./operations/block.ops";

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
 * }}
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
    */
    constructor(codex) {
        super(codex);

        this.method('delete', deletion => this.handleDelete(deletion));
        this.method('insert', insertion => this.handleInsertBlocks(insertion));

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
                    console.log(empties);
                    if (empties.length === 0) return;
                    // const ops = empties.map(empty => new BlocksRemoval(this, {i}));
                    const ops = [
                        new BlocksRemoval(this, {ids: empties.map(empty => empty.id)})
                    ];
                    this.log('Removing empty text blocks:', empties, ops);

                    this.codex?.tx(ops).execute();   
                }
            })
        });
    }
    
    /** @type {HTMLParagraphElement?} */
    element = $state(null);
    
    selection = $derived.by(() => {
        const firstChild = this.children.find(child => child.selected);
        const lastChild = this.children.findLast(child => child.selected);

        const firstOffset = firstChild && firstChild.start + (firstChild instanceof Text ? firstChild.selection?.start : 0);
        const lastOffset = lastChild && lastChild.start + (lastChild instanceof Text ? lastChild.selection?.end : 1);

        console.log(firstOffset, lastOffset)

        return {
            anchorOffset: firstOffset,
            focusOffset: lastOffset,
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
    
    
    /** @param {InputEvent} e */
    oninput = e => {
        
    }


    /**
     * @param {InputEvent} e
     */
    onbeforeinput = e => {
        if (e.inputType === 'insertText' && e.data) {
            if (this.selection.isCollapsed && this.children.find(child => child.selected) instanceof Linebreak) {
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
                        offset: this.selection.anchorOffset || 0
                    })
                ]);
                const blocks = tx?.execute()?.[0]?.result;
                if (blocks) {
                    blocks.at(-1)?.focus?.(new Focus(-1, -1));
                }
            }
        }
    }
    
    /** @param {KeyboardEvent} e */
    onkeydown = e => {
        if (!this.codex) return;
        if (this.codex?.selection.collapsed) {
            const child = this.children.find(c => c.selected);
            if (e.key === 'Enter') {
                this.log('Enter pressed in paragraph:', this.index);
                e.preventDefault();
                if (e.shiftKey) {
                    const block = this.codex?.selection.anchoredBlock;
                    
                    /** @param {import('./linebreak.svelte').Linebreak} linebreak */
                    const handleLinebreak = linebreak => {
                        if (!this.codex) return;
                        const blocksBefore = this.children.filter(child => child.index <= linebreak.index);
                        const blocksAfter = this.children.filter(child => child.index > linebreak.index);
                        const newLinebreak = new Linebreak(this.codex);
                        
                        this.children = [
                            ...blocksBefore,
                            newLinebreak,
                            ...blocksAfter,
                        ];
                        
                        newLinebreak.focus();
                    }
                    
                    if (block && block instanceof Linebreak) {
                        handleLinebreak(block);
                    } else if (block && block instanceof Text) {
                        const offset = block.selection?.start;
                        this.log('Shift + Enter pressed in text block:', block, 'at offset:', offset);
                        if (offset === undefined || offset < 0) return;
                        if (offset > block.text.length) return;
                        const newLinebreak = new Linebreak(this.codex);
                        if (offset === 0) {
                            
                            this.children = [
                                ...this.children.filter(child => child.index < block.index),
                                newLinebreak,
                                ...this.children.filter(child => child.index >= block.index),
                            ];
                            block.focus(new Focus(0, 0));
                        } else if (offset > 0 && offset < block.text.length) {
                            this.log('Split text block at offset:', offset);
                            const newText = block.$split(offset);
                            if (newText) {
                                this.children = [
                                    ...this.children.filter(child => child.index <= block.index),
                                    newLinebreak,
                                    newText,
                                    ...this.children.filter(child => child.index > block.index),
                                ];
                                newText.focus(new Focus(0, 0));
                            }
                            
                        } else if (offset === block.text.length) {
                            const isLinebreakAfter = this.children[block.index + 1] instanceof Linebreak;
                            const add = 1;
                            this.log('Inserting linebreak after block:', block.index + add);
                            this.children = [
                                ...this.children.filter(child => child.index <= block.index + add),
                                newLinebreak,
                                ...this.children.filter(child => child.index > block.index + add),
                            ];
                            newLinebreak.focus(new Focus(0, 0));
                        }
                    }
                } else {
                    const block = this.children.find(c => c.selected);
                    if (!block) return;
                    const beforeBlocks = (block && this.children.filter(child => child.index < block.index)) || [];
                    const offset = block.start + (block instanceof Text ? (block.selection?.start || 0) : 0);
                    const p = this.split(offset);
                    if (p) p.focus(new Focus(0, 0));
                }
            } else if (e.key === 'Backspace') {
                this.log('Backspace pressed in paragraph:', this.index);
                e.preventDefault();
                const previous = child && this.children.find(c => c.index === child.index - 1);
                if (previous) {
                    const offset = (previous instanceof Text ? previous.start - previous.selection?.start : previous.start);
                    previous.delete(-2, -1);
                    this.focus(new Focus(offset, offset));
                } else {
                    const previous = this.parent?.children.findLast(c => c.index < this.index && c.capabilities.has(MERGEABLE));
                    this.log('Merging with previous block:', previous);
                    previous?.merge?.(new MergeData(this.children.slice(0, -1), -1));
                    this.rm();
                    // previous?.focus?.(new Focus(-1, -1));
                }
            } else if (e.key === 'Delete') {
                this.log('Delete pressed in paragraph:', this.index);
                e.preventDefault();
                const next = child && this.children.find(c => c.index === child.index + 1);
                if (child instanceof Linebreak && next) {
                    child.delete();
                    next.focus?.(new Focus(0, 0));
                } else if ((child instanceof Linebreak && !next) || (child instanceof Text && child === this.children.at(-2) && next instanceof Linebreak)) {
                    this.log('Try merging next block with this');
                    const nextMergeable = this.parent?.children.find(c => c.index > this.index && c.capabilities.has(MERGEABLE));
                    if (nextMergeable) {
                        const offset = this.end;
                        this.merge(new MergeData(nextMergeable.children.slice(0, -1), -1));
                        nextMergeable.rm();
                        this.focus(new Focus(offset -1, offset -1));
                    }
                } else if (child instanceof Text && next && child.selection?.end === child.text.length) {
                    const offset = child.selection.start;
                    next.delete(0, 1);
                    this.log('Deleting character from next text block:', next);
                    child.focus?.(new Focus(offset, offset));
                }
            }
        }
    }
    
    normalize = () => {
        if (!this.codex) return;

        /** @param {Number} blockIndex */
        const merge = (blockIndex) => {
            if (blockIndex >= this.children.length - 1) return;
            const current = this.children[blockIndex];
            const next = this.children[blockIndex + 1];
            if (current instanceof Text && next instanceof Text && current.style === next.style && !current.link && !next.link) {
                this.log(`Merging text blocks at index ${blockIndex} and ${blockIndex + 1}`);
                current.merge(next);
                this.children = this.children.filter(c => c !== next);
                merge(blockIndex);
            } else {
                merge(blockIndex + 1);
            }
        }

        if (this.children.length === 0) {
            this.children = [new Linebreak(this.codex)];
        } else {
            merge(0);
        }

        if (!(this.children.at(-1) instanceof Linebreak)) {
            this.children.push(new Linebreak(this.codex));
        }
    }
    
    /** @param {Number} offset */
    truncate = (offset) => {
        
    }
    
    /** @param {Number} offset */
    split = offset => {
        if (!this.codex) return;

        const splittingBlock = this.children.find(child => offset >= child.start && offset <= child.end);
        if (!splittingBlock) return;

        const afterBlocks = (splittingBlock && this.children.filter(child => child.index > splittingBlock.index && !child.last)) || [];

        const startBlock = splittingBlock instanceof Text ? splittingBlock.$split(offset - splittingBlock.start) : null;
        
        this.children = this.children.filter(child => !(afterBlocks.includes(child)));
        
        const newParagraph = new Paragraph(this.codex);
        newParagraph.children = [
            ...(startBlock ? [startBlock] : []),
            ...afterBlocks,
            new Linebreak(this.codex),
        ];
        
        const parentIndex = this.codex.children.indexOf(this);
        this.codex.children = [
            ...this.codex.children.slice(0, parentIndex + 1),
            newParagraph,
            ...this.codex.children.slice(parentIndex + 1),
        ];
        
        return newParagraph;
    }
    
    /**
    * @param {(Text | Linebreak)[]} children
    * @param {Number} [at]
    * @param {'blocks'|'global'} [scope='blocks']
    */
    join = (children, at, scope = "blocks") => {
        if (children.length === 0) return;
        if (children.some(child => !(child instanceof Text || child instanceof Linebreak))) throw new Error(`Invalid children types for joining in paragraph ${this.index}. Expected Text or Linebreak.`);

        if (scope === 'blocks') {
            at ??= this.children.length;
            if (at < 0) at = this.children.length + at + 1;
            if (at < 0 || at > this.children.length) throw new Error(`Invalid index ${at} for joining children in paragraph ${this.index}.`);

            this.log(`Joining ${children.length} children at index ${at} in paragraph ${this.index}.`);
            this.children = [
                ...this.children.slice(0, at),
                ...children,
                ...this.children.slice(at),
            ];
            this.log('After: ', this.children);
        } else if (scope === 'global') {
            this.log(`Joining ${children.length} children globally at index ${at} in paragraph ${this.index}.`);
            at ??= (this.children.at(-1)?.end || 0);
            if (at < 0) at = this.children.at(-1)?.end + at + 1;
            if (at < 0 || at > this.children.at(-1)?.end) throw new Error(`Invalid index ${at} for joining children in paragraph ${this.index}.`);

            if (!this.children.length && this.codex) {
                this.children.push(new Linebreak(this.codex));
                return;
            }

            const child = this.children.find(c => c.start <= at && c.end >= at);
            if (!child) throw new Error(`Invalid index ${at} for joining children in paragraph ${this.index}.`);
            this.log(`Joining children at index ${at} in paragraph ${this.index}. Found child:`, child);
            if (child instanceof Text) child.$split(at - child.start);
            const childIndex = this.children.indexOf(child);
            if (childIndex === -1) throw new Error(`Invalid child index ${childIndex} for joining children in paragraph ${this.index}.`);

            this.children = at === 0 ? [
                ...children,
                ...this.children
            ] : [
                ...this.children.slice(0, childIndex + 1),
                ...children,
                ...this.children.slice(childIndex + 1),
            ];
        }
    }

    /** @param {import('../capabilities/merge.capability').MergeData} data */
    merge = data => {
        /** @type {(Text | Linebreak)[]} */
        const blocks = data.blocks.filter(block => block instanceof Text || block instanceof Linebreak);
        this.log('Merging blocks:', blocks);
        const offset = this.end;
        this.join(blocks, data.at - 1);
        this.log('After merge:', this.children);
        this.focus(new Focus(offset - 1, offset - 1));
    }

    /**
    * Generates a new blocks from the given content.
    * @param {ParagraphContent} content 
    * @param {Number} at 
    * @param {'blocks'|'global'} [scope='blocks']
    */
    generate = (content, at, scope = 'blocks') => {
        this.log('Generating blocks from content:', content, 'at index:', at);
        if (!this.codex) return;
        const blocks = [];
        for (const item of content) {
            if (item.type === 'linebreak') {
                blocks.push(new Linebreak(this.codex));
            } else if (item.type === 'text') {
                blocks.push(new Text(this.codex, item));
            }
        }
        this.join(blocks, at, scope);
    }

    /** @param {Focus} f @param {Number} attempts */
    focus = (f, attempts = 0) => requestAnimationFrame(() => {
        this.log('Focusing paragraph:', this.index, 'with focus:', f);
        console.trace();
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
        
        let startBlock = this.children.find(child => start >= child.start && start <= child.end);
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


    debug = $derived(`${this.selection.anchorOffset} - ${this.selection.focusOffset} [length: ${this.length}]`);

    /**
     * Handles the deletion of the paragraph.
     * @param {import('../../values/codex.values').Deletion} deletion 
    */
    handleDelete = deletion => {
        this.log('Handling deletion:', deletion);
        if (deletion.mode === 'auto') {
            this.children.filter(c => c.selected).forEach(child => {
                if (child instanceof Text) {
                    // child.d
                } else if (child instanceof Linebreak) {
                    child.rm();
                }
            })
        }
    }



    /**
     * Handles the insertion of a new block.
     * @param {import('./operations/paragraph.ops').ParagraphBlockInsertionData} data
     */
    handleInsertBlocks = data => {
        const blocks = data.blocks.map(({ type, init }) => {
            const B = this.blocks[type];
            if (B && this.codex) {
                const block = new B(this.codex, init);
                return block;
            }
        }).filter(b => !!b);
        this.join(blocks, data.offset, 'global');

        return blocks;
    }
}