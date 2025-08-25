import { Operation } from "$lib/utils/operations.utils";


/**
 * @typedef {Object} TextInsertOperationData
 * @property {string} text - The insert text.
 * @property {number} offset - The offset where the text is inserted.
 */

export class TextInsertOperation extends Operation {
    /**
     * @param {import('$lib/states/block.svelte').Block} block
     * @param {TextInsertOperationData} data
     * @param {Operation} [undo]
     */
    constructor(block, data, undo) {
        super(block, 'insert', data);
        this.text = data.text;
        this.offset = data.offset;

        this.undo = undo || new TextDeleteOperation(block, {
            from: data.offset,
            to: data.offset + data.text.length
        }, this);
    }

    get debug() {
        return `Insert "${this.text}" at ${this.offset}`;
    }
}


/**
 * @typedef {Object} TextDeleteOperationData
 * @property {number} from - The starting offset of the deleted text.
 * @property {number} to - The ending offset of the deleted text.
 */

export class TextDeleteOperation extends Operation {
    /**
     * @param {import('$lib/states/block.svelte').Block} block
     * @param {TextDeleteOperationData} data
     * @param {Operation} [undo]
     */
    constructor(block, data, undo) {
        super(block, 'delete', data);
        this.from = data.from;
        this.to = data.to;

        this.undo = undo || new TextInsertOperation(block, {
            text: '',
            offset: this.from
        }, this);
    }

    get debug() {
        return `Delete from ${this.from} to ${this.to}`;
    }
}