import { MERGEABLE } from "$lib/utils/capabilities";
import { Focus } from "$lib/values/focus.values";
import { MegaBlock } from "../block.svelte";
import { Strategy } from "../strategy.svelte";


/**
 * 
 * @param {import('../codex.svelte').Codex} codex 
 * @param {any} content 
 */
const replace = (codex, content) => {


    const startBlock = codex.children.find(child => child.selected);
    const endBlock = codex.children.findLast(child => child.selected && child !== startBlock);
    const betweenBlocks = ((startBlock && endBlock) && codex.children.slice(codex.children.indexOf(startBlock) + 1, codex.children.indexOf(endBlock))) || []; 

    const isThereSelectedBlocksBeforeEnd = betweenBlocks.length || (startBlock && endBlock && startBlock !== endBlock);

    /** @type {import('$lib/utils/operations.utils').Operation[]} */
    const ops = [];
    if (betweenBlocks.length) betweenBlocks.forEach(b => {
        ops.push(...b.prepareDestroy());
    })
    ops.push(...(startBlock ? (startBlock.prepare('remove')): []));
    if (endBlock && endBlock !== startBlock) ops.push(...(endBlock ? (endBlock.prepare('remove')): []));

    // if (startBlock instanceof MegaBlock && content?.length) {
    //     const innerIndex = startBlock.children.indexOf(startBlock.children.find(child => child.selected));
    //     ops.push(...startBlock.prepare('insert', {
    //         blocks: content,
    //         offset: innerIndex + 1
    //     }));
    // }
    
    codex.log('Removing between blocks:', betweenBlocks.map(b => b.id).join(', '));
    codex.log('Ops:', ops);

    const startPosition = startBlock?.getRelativePosition();
    codex.log('Start position:', startPosition);



    if (ops.length) {
        codex.tx(ops).after(() => {
            if (endBlock && endBlock.capabilities.has(MERGEABLE) && isThereSelectedBlocksBeforeEnd) {
                if (startBlock?.capabilities.has(MERGEABLE)) {
                    const ops = startBlock.prepare('merge', endBlock);
                    codex.log('Merging blocks with ops:', ops);
                    return ops;
                }
            }
            return [];
        }).execute();


    }

    requestAnimationFrame(() => {
        const coordinates = startBlock?.toDOM(startPosition);
        codex.log('Coordinates to set selection:', coordinates);
        if (coordinates?.start) codex.setRange({start: coordinates.start});
    });

}

/**
 * @typedef {Object} CodexKeydownContext
 * @property {KeyboardEvent} event - The keyboard event that triggered the strategy.
 */

export const multiBlockBackspaceStrategy = new Strategy(
    'codex-delete-strategy',
    /** @param {CodexKeydownContext} context */
    (codex, context) => {
        if (!['Delete', 'Backspace', 'Enter'].includes(context.event.key)) return false;
        if (!codex.selection.isMultiBlock) return false;
        return true;
    },
    /** @param {CodexKeydownContext} context */
    (codex, context) => {
        codex.log('Executing multi-block backspace strategy');
        replace(codex, null);
    },
).tag('backspace').tag('multi-block').tag('keydown')