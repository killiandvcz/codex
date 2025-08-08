import { Operation } from "$lib/states/operations.svelte";

/** @typedef {import('../../blocks/text.svelte').Text} TextBlock */

export class TextInputOperation extends Operation {
    /**
    * Creates an operation for text input.
    * @param {TextBlock} block - The block this operation applies to.
    * @param {String} text - The text input.
    * @param {Number} [offset=0] - The offset in the text where the input occurs.
    */
    constructor(block, text, offset = 0) {
        super(block, 'text-input', {
            text,
            offset
        });
        this.undo = new TextDeleteOperation(block, offset, text.length, this);
        this.text = text;
        this.offset = offset;
    }   

    get debug() {
        return `TextInputOperation(${this.text}, ${this.offset})`;
    }
}


export class TextDeleteOperation extends Operation {
    /**
    * Creates an operation for text deletion.
    * @param {TextBlock} block - The block this operation applies to.
    * @param {Number} start - The offset in the text where the deletion occurs.
    * @param {Number} end - The length of the text deleted.
    * @param {TextInputOperation} [redo] - The operation to redo the text input.
    */
    constructor(block, start, end, redo) {
        //TODO : calculate the text that was deleted
        const text = ""
        super(block, 'text-delete', {
            start,
            end
        });
        this.undo = redo ?? new TextInputOperation(block, text, start);
        this.text = text;
        this.start = start;
        this.end = end;
    }

    get debug() {
        return `TextDeleteOperation(${this.start}, ${this.end})`;
    }
}

/**
 * @typedef {Object} TextStyleObject
 * @property {Boolean} bold - Whether the text is bold.
 * @property {Boolean} italic - Whether the text is italic.
 * @property {Boolean} underline - Whether the text is underlined.
 * @property {Boolean} strikethrough - Whether the text is struck through.
 * @property {Boolean} code - Whether the text is formatted as code.
 */

export class TextStyleOperation extends Operation {
    /**
    * Creates an operation for text style changes.
    * @param {TextBlock} block - The block this operation applies to.
    * @param {TextStyleObject} styles - The styles applied (e.g., { bold: true, italic: false }).
    * @param {TextStyleObject} [undoStyles] - The styles to revert to when undoing this operation.
    */
    constructor(block, styles, undoStyles) {
        super(block, 'text-style', {
            styles,
            undoStyles
        }, undoStyles ? new TextStyleOperation(block, undoStyles, styles) : undefined);
        this.styles = styles;
        this.undoStyles = undoStyles;
    }
}

export class TextLinkOperation extends Operation {
    /**
    * Creates an operation for text link changes.
    * @param {TextBlock} block - The block this operation applies to.
    * @param {String} link - The URL of the link.
    * @param {String} [undoLink] - The previous link to revert to when undoing this operation.
    */
    constructor(block, link, undoLink) {
        super(block, 'text-link', {
            link
        }, undoLink ? new TextLinkOperation(block, undoLink) : undefined);
        this.link = link;
        this.undoLink = undoLink;
    }
}