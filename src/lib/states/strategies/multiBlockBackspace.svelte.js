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
        // console.log('Executing multi-block backspace strategy');
    },
)

multiBlockBackspaceStrategy.tag('backspace').tag('multi-block').tag('keydown')