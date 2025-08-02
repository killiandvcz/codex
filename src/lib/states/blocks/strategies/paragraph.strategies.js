import { Strategy } from "$lib/states/strategy.svelte";

/**
 * @typedef {Object} ParagraphBackspaceContext
 * @property {KeyboardEvent} event - The keyboard event that triggered the strategy.
 * @property {import('../paragraph.svelte').Paragraph} paragraph - The paragraph block that the strategy is applied to.
 */

export const paragraphBackspaceStrategy = new Strategy(
    'paragraph-backspace-strategy',
    /** @param {ParagraphBackspaceContext} context */
    (codex, context) => {
        if (context.event.key !== 'Backspace') return false;
        if (!codex.selection.isMultiBlock) return false;
        return true;
    },
    /** @param {ParagraphBackspaceContext} context */
    (codex, context) => {
        // console.log('Executing paragraph backspace strategy');
    }
)

paragraphBackspaceStrategy.tag('backspace').tag('paragraph').tag('keydown')