/**
 * @typedef {Object} OperationObject
 * @property {String} block - The ID of the block this operation applies to.
 * @property {String} name - The name of the operation.
 * @property {Object} data - Additional data for the operation.
 * @property {OperationObject?} [undo] - The undo operation, if any.
 */

export class Operation {
    /** @param {import('./block.svelte').Block} block @param {String} name @param {Object} data @param {Operation} [undo] */
    constructor(block, name, data = {}, undo) {
        this.block = block;
        this.name = name;
        this.data = data;
        this.undo = undo;
        this.timestamp = Date.now();
        this.id = crypto.randomUUID();
    }

    /** @returns {OperationObject} */
    toJSON = () => ({
        block: this.block.id,
        name: this.name,
        data: JSON.parse(JSON.stringify(this.data)),
        ...(this.timestamp ? { timestamp: this.timestamp } : {}),
        // ...(this.undo ? { undo: this.undo.toJSON() } : {})
    });
}