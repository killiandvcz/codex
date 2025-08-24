import { Deletion } from "$lib/values/codex.values";
import { Strategy } from "../strategy.svelte";

/**
 * @typedef {Object} MultiBlockBackspaceContext
 * @property {KeyboardEvent} event - The keyboard event that triggered the strategy.
 */

export const multiBlockBackspaceStrategy = new Strategy(
    'multi-block-backspace',
    /** @param {MultiBlockBackspaceContext} context */
    (codex, context) => {
        if (context.event.key !== 'Backspace') return false;
        if (!codex.selection.isMultiBlock) return false;
        return true;
    },
    /** @param {MultiBlockBackspaceContext} context */
    (codex, context) => {
        codex.log('Executing multi-block backspace strategy');

        const deletion = new Deletion({
            mode: "auto",
            direction: "backward",
            source: 'keyboard',
            data: {
                event: context.event,
                start: codex.selection.startBlock,
                end: codex.selection.endBlock,
            }
        });

        codex.children.filter(c => c.selected).forEach(c => c.call('delete', deletion));


        
    },
).tag('backspace').tag('multi-block').tag('keydown')