export class Operation {
    /** @param {import('../states/block.svelte').Block} block  @param {String} name @param {any} data @param {Operation} [undo] */
    constructor(block, name, data = {}, undo) {
        this.block = block;
        this.name = name;
        this.data = data;
        this.undo = undo;
    }

    execute() {
        return this.block.call(this.name, this.data);
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

    execute() {
        const executedOps = [];
        const results = [];
        
        try {
            for (const op of this.operations) {
                const result = op.execute();
                results.push({ operation: op, result });
                executedOps.push(op);
            }
            
            if (this.codex) {
                this.codex.history.add(this);
            }
            
            return results;
        } catch (error) {
            for (let i = executedOps.length - 1; i >= 0; i--) {
                const op = executedOps[i];
                if (op.undo) {
                    try {
                        op.undo.execute();
                    } catch (undoError) {
                        console.error('Erreur lors du rollback:', undoError);
                    }
                }
            }
            throw error;
        }
    }

    toJSON() {
        return {
            operations: Array.from(this.operations).map(op => op.toJSON())
        };
    }

}