import { Strategy } from "$lib/states/strategy.svelte";
import { Linebreak } from "../linebreak.svelte";
import { Text } from "../text.svelte";

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

/**
 * @typedef {Object} ParagraphRefocusContext
 * @property {import('../paragraph.svelte').Paragraph} paragraph - The paragraph block that the strategy is applied to.
 * @property {import('../../block.svelte').Block} block - The block that the strategy is applied to.
 */
export const paragraphRefocusStrategy = new Strategy(
    'paragraph-refocus-strategy',
    /** @param {ParagraphRefocusContext} context */
    (codex, context) => {
        if (context.block instanceof Linebreak) {
            const before = context.block.before;
            if (before instanceof Text) {
                return true;
            }
        }
        return false;
    },
    /** @param {ParagraphRefocusContext} context */
    (codex, context) => {
        console.log('Executing paragraph refocus strategy');
        if (context.block instanceof Linebreak) {
            const before = context.block.before;
            if (before instanceof Text) {
                before.focus?.(-1, -1);
            }
        }
        
    }

).tag('refocus').tag('paragraph').tag('linebreak')




export const paragraphStrategies = [
    paragraphBackspaceStrategy,
    paragraphRefocusStrategy
];