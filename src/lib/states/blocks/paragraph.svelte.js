import { MegaBlock } from "../block.svelte";
import { Linebreak } from "./linebreak.svelte";
import { Text } from "./text.svelte";

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
            }
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
        });
    }
    
    /** @type {HTMLParagraphElement?} */
    element = $state(null);
    
    debug = $derived(`Paragraph ${this.index} - ${this.selection.anchorOffset} - ${this.selection.focusOffset}`);
    
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
    
    /** @param {InputEvent} e */
    oninput = e => {
        
    }
    
    /** @param {KeyboardEvent} e */
    onkeydown = e => {
        if (window.getSelection()?.isCollapsed) {
            
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    const block = this.codex?.selection.anchoredBlock;
                    // console.log('Shift + Enter pressed in block:', block);
                    
                    /** @param {import('./linebreak.svelte').Linebreak} linebreak */
                    const handleLinebreak = linebreak => {
                        const blocksBefore = this.children.filter(child => child.index <= linebreak.index);
                        const blocksAfter = this.children.filter(child => child.index > linebreak.index);
                        const newLinebreak = new Linebreak(this.codex);
                        
                        this.children = [
                            ...blocksBefore,
                            newLinebreak,
                            ...blocksAfter,
                        ];
                        
                        const focus = () => {
                            requestAnimationFrame(() => {
                                if (newLinebreak.element) {
                                    this.codex?.selection?.setRange(newLinebreak.element, 0, newLinebreak.element, 0);
                                } else {
                                    console.warn('New linebreak element is not available yet.');
                                    focus();
                                }
                            })
                        }
                        
                        focus();
                    }
                    
                    if (block && block instanceof Linebreak) {
                        // console.log('Shift + Enter pressed in linebreak block:', block);
                        handleLinebreak(block);
                    } else if (block && block instanceof Text) {
                        const offset = this.codex?.selection.range?.startOffset || 0;
                        const length = block.text.length;
                        // console.log('Shift + Enter pressed in text block:', block, 'at offset:', offset, 'length:', length);
                        if (offset >= length) {
                            const blocksBefore = this.children.filter(child => child.index <= block.index);
                            const blocksAfter = this.children.filter(child => child.index > block.index);
                            if (blocksAfter[0] && blocksAfter[0] instanceof Linebreak) {
                                // console.log('Next block is a linebreak, inserting new linebreak');
                                handleLinebreak(blocksAfter[0]);
                                return;
                                
                            }
                            const newLinebreak = new Linebreak(this.codex);
                            
                            this.children = [
                                ...blocksBefore,
                                newLinebreak,
                                ...blocksAfter,
                            ];
                            
                            const focus = () => {
                                requestAnimationFrame(() => {
                                    if (newLinebreak.element) {
                                        this.codex?.selection?.setRange(newLinebreak.element, 0, newLinebreak.element, 0);
                                    } else {
                                        console.warn('New linebreak element is not available yet.');
                                        focus();
                                    }
                                })
                            }
                            
                            focus();
                        } else {
                            const newText = block.split(offset);
                            const blocksBefore = this.children.filter(child => child.index <= block.index);
                            const blocksAfter = this.children.filter(child => child.index > block.index);
                            const newLinebreak = new Linebreak(this.codex);
                            this.children = [
                                ...blocksBefore,
                                newLinebreak,
                                newText,
                                ...blocksAfter,
                            ];
                            const focus = () => {
                                requestAnimationFrame(() => {
                                    if (newText.element) {
                                        this.codex?.selection?.setRange(newText.element, 0, newText.element, 0);
                                    } else {
                                        console.warn('New text element is not available yet.');
                                        focus();
                                    }
                                })
                            }
                            focus();
                            
                        }
                        
                        
                        
                    }
                } else {
                    const block = this.codex?.selection.anchoredBlock;
                    const beforeBlocks = this.children.filter(child => child.index < block.index);
                    //sum the offsets of the blocks before the current block
                    const beforeOffset = beforeBlocks.reduce((acc, child) => acc + (child instanceof Text ? child.text.length : 1), 0);
                    console.log('Enter pressed in block:', block, 'at index:', block.index, 'beforeOffset:', beforeOffset);
                    const offset = (block instanceof Text ? this.codex?.selection.range?.startOffset || 0 : 1) + beforeOffset;
                    console.log('Offset in block:', offset);
                    
                    const p = this.split(offset);

                    const focus = () => requestAnimationFrame(() => {
                        if (p.element) {
                            p.focus(0);
                        } else {
                            console.warn('New paragraph element is not available yet.');
                            focus();
                        }
                    })
                    focus();
                }
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                


                
                
            } else {
                
            }
        }
    }
    
    
    /** @param {Number} offset */
    truncate = (offset) => {
        
    }
    
    /** @param {Number} offset */
    split = offset => {
        
        const splittingBlock = this.children.find(child => offset >= child.start && offset <= child.end);
        console.log('Splitting block at offset:', offset, 'in block:', splittingBlock);
        
        const afterBlocks = this.children.filter(child => child.index > splittingBlock.index);
        console.log('After blocks:', afterBlocks);
        
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
     */
    join = (children) => {
        if (children.length === 0) return;

        for (const child of children) {
            if (!(child instanceof Text || child instanceof Linebreak)) {
                throw new Error(`Invalid child type: ${child.constructor.name}. Expected Text or Linebreak.`);
            }
            this.children.push(child);
        }
    }


    /** @param {Number} offset */
    focus = offset => {
        const block = this.children.find(child => offset >= child.start && offset <= child.end);
        if (this.element && block && block.element) {
            if (block instanceof Text) {
                this.codex?.selection?.setRange(block.element, offset - block.start, block.element, offset - block.start);
            } else if (block instanceof Linebreak) {
                const linebreakElement = block.element;
                // find the offset of the block in the paragraph element parent
                const parentElement = this.element;
                const blockOffset = Array.from(parentElement.childNodes).indexOf(linebreakElement);
                this.codex?.selection?.setRange(parentElement, blockOffset, parentElement, blockOffset);
            }
        }        
    }
    
    
}