import { Strategy } from "$lib/states/strategy.svelte";
import { Focus } from "$lib/values/focus.values";
import { Linebreak } from "../linebreak.svelte";
import { Text } from "../text.svelte";

/**
* @param {import('../paragraph.svelte').Paragraph} paragraph 
* @param {import('../paragraph.svelte').ParagraphContent} [content] 
*/
const replace = (paragraph, content) => {
    
    /** @type {import('../text.svelte').Text|import('../linebreak.svelte').Linebreak} */
    const start = paragraph.children.find(child => child.selected);
    /** @type {import('../text.svelte').Text|import('../linebreak.svelte').Linebreak} */
    const end = paragraph.children.findLast(child => child.selected);

    const between = paragraph.children.slice(paragraph.children.indexOf(start) + 1, paragraph.children.indexOf(end));

    console.log(start.start, (start instanceof Text ? start.selection?.start : 0));
    const data = {
        startOffset: start.start + (start instanceof Text ? start.selection?.start : 0),
        endOffset: end.start + (end instanceof Text ? end.selection?.end : 0),
        startSelection: start.selection?.start || 0,
        endSelection: end.selection?.end || 0
    }

    between.forEach(b => b.rm());

    end instanceof Linebreak ? end.rm() : end.delete(0, data.endSelection || -1);
    start instanceof Linebreak ? start.rm() : start.delete(data.startSelection || 0, -1);

    if (content) paragraph.generate(content, data.startOffset, 'global');
    if (content) paragraph.focus(new Focus(data.startOffset + 1, data.startOffset + 1));
    else paragraph.focus(new Focus(data.startOffset , data.startOffset))
    

    return data;
}

/**
* @typedef {Object} ParagraphKeydownContext
* @property {KeyboardEvent} event - The keyboard event that triggered the strategy.
* @property {import('../paragraph.svelte').Paragraph} block - The paragraph block that the strategy is applied to.
*/

export const paragraphDeleteStrategy = new Strategy(
    'paragraph-delete-strategy',
    /** @param {ParagraphKeydownContext} context */
    (codex, context) => {
        if (!['Delete', 'Backspace', 'Enter'].includes(context.event.key)) return false;
        if (!codex.selection.isMultiBlock) return false;
        return true;
    },
    /** @param {ParagraphKeydownContext} context */
    (codex, context) => {
        const paragraph = context.block;
        const data = replace(paragraph);

        if (context.event.key === 'Enter') {
            if (context.event.shiftKey) {
                const linebreak = new Linebreak(codex);
            } else {
                const next = paragraph.split(data.startOffset);
                if (next) next.focus(new Focus(0, 0));
            }
        }
    }
).tag('paragraph').tag('keydown').tag('delete').tag('backspace').tag('enter');

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
        if (context.block instanceof Linebreak) {
            const before = context.block.before;
            if (before instanceof Text) {
                before.focus?.(-1, -1);
            }
        }
        
    }
    
).tag('refocus').tag('paragraph').tag('linebreak')



/**
 * @typedef {Object} ParagraphBeforeInputContext
 * @property {InputEvent} event - The input event that triggered the strategy.
 * @property {import('../paragraph.svelte').Paragraph} block - The paragraph block that the strategy is applied to.
 */
export const paragraphBeforeInputStrategy = new Strategy(
    'paragraph-beforeinput-strategy',
    (codex, context) => true,
    (codex, context) => {
        /** @type {ParagraphBeforeInputContext} */
        const { event, block } = context;
        event.preventDefault();
        if (event.inputType === 'insertText') {
            block.log('Before input event:', event);

            if (event.data) {
                const data = replace(block, [{
                    type: 'text',
                    text: event.data || '',
                }])
            }
        }
    }
).tag('beforeinput')


export const paragraphStrategies = [
    paragraphDeleteStrategy,
    paragraphRefocusStrategy,
    paragraphBeforeInputStrategy
];