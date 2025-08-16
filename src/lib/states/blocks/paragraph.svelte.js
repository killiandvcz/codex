import { MegaBlock } from "../block.svelte";
import { Linebreak } from "./linebreak.svelte";
import { Text } from "./text.svelte";
import { paragraphStrategies } from "./strategies/paragraph.strategies";
import { MERGEABLE, MergeData } from "../capabilities/merge.capability";
import { Focus } from "$lib/values/focus.values";

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
 * @extends {MegaBlock<Text|Linebreak>}
 */
export class Paragraph extends MegaBlock {
    /**
    * @param {import('../codex.svelte').Codex} codex
    */
    constructor(codex) {
        super(codex, {
            type: 'paragraph',
            blocks: [ Text, Linebreak ],
            operations: {
                truncate: {
                    type: 'truncate',
                    params: ['offset'],
                    handler: 'truncate'
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
                },
            },
            strategies: paragraphStrategies,
            capabilities: [ MERGEABLE ]
        });
        
        
        $effect.root(() => {
            $effect(() => {
                if (this.codex && this.element) {
                    const lastChild = this.children[this.children.length - 1];
                    if (!lastChild ) {
                        
                        this.children = [...this.children, 
                            new Linebreak(this.codex)
                        ];
                    }
                }
            })
            
            $effect(() => {
                if (this.element && this.children) {
                    const styles = this.children.map(child => child instanceof Text ? child.style : null).filter(style => style);
                    if (styles) this.normalize();
                }
            })

            $inspect(this.children);
        });

        
    }
    
    /** @type {HTMLParagraphElement?} */
    element = $state(null);
    
    
    
    selection = $derived.by(() => {
        // Récupère la sélection globale du codex
        const globalSelection = this.codex?.selection;
        if (!globalSelection?.range) {
            return {
                anchorOffset: null,
                focusOffset: null,
                isCollapsed: false,
                isInParagraph: false
            };
        }
        
        const anchoredBlock = globalSelection.anchoredBlock;
        const focusedBlock = globalSelection.focusedBlock;
        
        // Fonction helper pour calculer l'offset local d'un block dans ce paragraphe
        const getLocalOffset = (block, globalOffset) => {
            if (!this.children.includes(block)) {
                return null; // Le block n'est pas dans ce paragraphe
            }
            
            // Calcule l'offset des blocks avant celui-ci
            const beforeBlocks = this.children.filter(child => child.index < block.index);
            const beforeOffset = beforeBlocks.at(-1)?.end ?? 0;
            
            // L'offset local est l'offset dans le block + l'offset des blocks précédents
            const localOffsetInBlock = block instanceof Text ? (beforeBlocks.at(-1) instanceof Linebreak ? globalOffset + 1 : globalOffset) : 1;
            return beforeOffset + localOffsetInBlock;
        };
        
        // Calcule les offsets locaux pour anchor et focus
        const anchorOffset = getLocalOffset(anchoredBlock, globalSelection.anchorOffset || 0);
        const focusOffset = getLocalOffset(focusedBlock, globalSelection.focusOffset || 0);
        
        // Détermine si la sélection est dans ce paragraphe
        const isAnchorInParagraph = anchorOffset !== null;
        const isFocusInParagraph = focusOffset !== null;
        const isInParagraph = isAnchorInParagraph || isFocusInParagraph;
        
        // Détermine si c'est collapsed
        const isCollapsed = anchorOffset === focusOffset && isAnchorInParagraph && isFocusInParagraph;
        
        return {
            anchorOffset: isAnchorInParagraph ? anchorOffset : null,
            focusOffset: isFocusInParagraph ? focusOffset : null,
            isCollapsed,
            isInParagraph,
            // Infos supplémentaires qui peuvent être utiles
            anchoredBlock: isAnchorInParagraph ? anchoredBlock : null,
            focusedBlock: isFocusInParagraph ? focusedBlock : null,
            isPartialSelection: isAnchorInParagraph !== isFocusInParagraph // Sélection qui commence ou finit dans ce paragraphe
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
                            const newText = block.split(offset);
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
                    const block = this.codex?.selection.anchoredBlock;
                    const beforeBlocks = (block && this.children.filter(child => child.index < block.index)) || [];
                    const beforeOffset = beforeBlocks.reduce((acc, child) => acc + (child instanceof Text ? child.text.length : 1), 0);
                    const offset = (block instanceof Text ? this.codex?.selection.range?.startOffset || 0 : 1) + beforeOffset;
                    const p = this.split(offset);
                    if (p) p.focus(new Focus(0, 0));
                }
            } else if (e.key === 'Backspace') {
                this.log('Backspace pressed in paragraph:', this.index);
                e.preventDefault();
                const previous = child && this.children.find(c => c.index === child.index - 1);
                if (child instanceof Linebreak) {
                    if (previous) previous.delete(-2, -1);
                    else {
                        const previous = this.parent?.children.findLast(c => c.index < this.index && c.capabilities.has(MERGEABLE));
                        this.log('Merging with previous block:', previous);
                        previous?.merge?.(new MergeData(this.children.slice(0, -1), -1));
                        this.rm();
                    }
                    
                } else if (child instanceof Text && child.selection?.start === 0) {
                    if (previous) {
                        previous.delete(-2, -1);
                    } else {
                        const previous = this.parent?.children.findLast(c => c.index < this.index && c.capabilities.has(MERGEABLE));
                        this.log('Merging with previous block:', previous, 'with children:', this.children);
                        previous?.merge?.(new MergeData(this.children.slice(0, -1), -1));
                        this.rm();
                    }
                }
            } else if (e.key === 'Delete') {
                this.log('Delete pressed in paragraph:', this.index);
                e.preventDefault();
                const next = child && this.children.find(c => c.index === child.index + 1);
                if (child instanceof Linebreak && next) {
                    child.delete();
                    next.focus?.(new Focus(0, 0));
                } else if (child instanceof Text && next && child.selection?.end === child.text.length) {
                    next.delete(0, 1);
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
        // Ensure the last child is a Linebreak
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
        this.log('Splitting paragraph at offset:', offset);

        const splittingBlock = this.children.find(child => offset >= child.start && offset <= child.end);
        this.log(JSON.stringify(this.children.map(c => ({...c.toJSON(), s: c.start, e: c.end })), null, 2));
        
        const afterBlocks = (splittingBlock && this.children.filter(child => child.index > splittingBlock.index)) || [];
        
        const startBlock = splittingBlock instanceof Text ? splittingBlock.split(offset - splittingBlock.start) : new Linebreak(this.codex);
        
        this.children = this.children.filter(child => !(afterBlocks.includes(child)));
        
        const newParagraph = new Paragraph(this.codex);
        newParagraph.children = [
            ...(startBlock ? [startBlock] : []),
            ...afterBlocks,
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
            at ??= this.children.at(-1)?.end;
            const child = this.children.find(c => c.start <= at || c.end >= at);
            if (!child) throw new Error(`Invalid index ${at} for joining children in paragraph ${this.index}.`);
        }
    }

    /** @param {import('../capabilities/merge.capability').MergeData} data */
    merge = data => {
        /** @type {(Text | Linebreak)[]} */
        const blocks = data.blocks.filter(block => block instanceof Text || block instanceof Linebreak);
        this.log('Merging blocks:', blocks);
        // if (blocks.length === 0) return;
        const offset = this.end;
        this.join(blocks, data.at - 1);
        this.log('After merge:', this.children);
        this.focus(new Focus(offset, offset));

        
    }

    /**
    * Generates a new blocks from the given content.
    * @param {ParagraphContent} content 
    * @param {Number} at 
    */
    generate = (content, at) => {
        if (!this.codex) return;
        const blocks = [];
        for (const item of content) {
            if (item.type === 'linebreak') {
                blocks.push(new Linebreak(this.codex));
            } else if (item.type === 'text') {
                blocks.push(new Text(this.codex, item));
            }
        }
        this.join(blocks, at);
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
        
        const startBlock = this.children.findLast(child => start >= child.start && start <= child.end);
        const endBlock = this.children.findLast(child => end >= child.start && end <= child.end);
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


    debug = $derived(`Paragraph ${this.index} - ${this.selection.anchorOffset} - ${this.selection.focusOffset} [length: ${this.length}]`);
}