import { tick } from 'svelte';

export class Operation {
    /** @param {import('../states/block.svelte').Block} block  @param {String} name @param {any} data @param {Operation} [undo] */
    constructor(block, name, data = {}, undo) {
        this.block = block;
        this.name = name;
        this.data = data;
        this.undo = undo;
    }

    /**
     * @param {Transaction} tx 
     */
    execute(tx) {
        const result = this.block.call(this.name, this.data);
        if (tx && tx instanceof Transaction) {
            tx.results.push({ operation: this, result });
            tx.executed.push(this);
        }
        return result;
    }



    toJSON() {
        return {
            block: {
                id: this.block.id,
                type: this.block.type,
            },
            method: this.name,
            data: this.data,
        }
    }

    get debug() {
        return ``;
    }
}


export class Transaction {

    /** @param {Operation[]} [ops] @param {import('$lib/states/codex.svelte').Codex} [codex] */
    constructor(ops = [], codex) {
        this.codex = codex;
        this.operations = new Set(ops);
    }

    /** @type {Array<{ operation: Operation, result: any }>} */
    results = [];

    /** @type {Array<Operation>} */
    executed = [];

    async execute() {
        if (this.codex) this.codex.history.current = this;
        const beforeSelection = this.codex?.selection?.range;

        try {
            for (const op of this.operations) op.execute(this);
            await tick().then(() => this.commit());
            return this.results;
        } catch (error) {
            for (let i = this.executed.length - 1; i >= 0; i--) {
                const op = this.executed[i];
                if (op.undo) {
                    try {
                        op.undo.execute(this);
                    } catch (undoError) {
                        console.error('Erreur lors du rollback:', undoError);
                    }
                }
            }
            this.codex?.selection?.setRange(beforeSelection?.startContainer, beforeSelection?.startOffset, beforeSelection?.endContainer, beforeSelection?.endOffset);
            throw error;
        } finally {
            if (this.codex) this.codex.history.current = null;
        }
    }


    commit = () => {
        if (this.codex) {
            this.codex.history.add(this);
        }
    }

    toJSON() {
        return {
            operations: Array.from(this.operations).map(op => op.toJSON())
        };
    }

}





// UTILS


/**
 * @template T {object}
 * @typedef {function(T): Promise<any>} Executor
 */

/**
 * @template T {object}
 * @param {import('../states/block.svelte').Block} block
 * @param {function(T): Operation[]} callback
 * @returns {Executor<T>}
 */
export const executor = (block, callback) => (data) => {
    const ops = callback(data);
    return Promise.resolve(block.codex?.tx(ops).execute());
}


export const SMART = Symbol('smart');