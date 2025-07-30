/**
 * Système de positions pour Codex
 * Permet de représenter et manipuler des positions de manière agnostique
 */

import { MegaBlock } from './block.svelte';

/**
 * Représente une position dans l'arbre de blocs
 * @class
 */
export class CodexPosition {
    /**
     * @param {number[]} path - Chemin depuis la racine [blockIndex, childIndex, ...]
     * @param {number} offset - Offset dans le nœud final
     * @param {import('./block.svelte').Block} [block] - Référence optionnelle au bloc
     */
    constructor(path, offset, block = null) {
        this.path = path;
        this.offset = offset;
        this.block = block;
    }

    /**
     * Compare deux positions
     * @param {CodexPosition} other
     * @returns {number} -1 si this < other, 0 si égales, 1 si this > other
     */
    compare(other) {
        // Comparer les chemins
        const minLength = Math.min(this.path.length, other.path.length);
        
        for (let i = 0; i < minLength; i++) {
            if (this.path[i] < other.path[i]) return -1;
            if (this.path[i] > other.path[i]) return 1;
        }
        
        // Si un chemin est préfixe de l'autre
        if (this.path.length < other.path.length) return -1;
        if (this.path.length > other.path.length) return 1;
        
        // Même chemin, comparer les offsets
        return this.offset - other.offset;
    }

    /**
     * Vérifie si deux positions sont égales
     * @param {CodexPosition} other
     * @returns {boolean}
     */
    equals(other) {
        return this.compare(other) === 0;
    }

    /**
     * Clone la position
     * @returns {CodexPosition}
     */
    clone() {
        return new CodexPosition([...this.path], this.offset, this.block);
    }

    /**
     * Représentation string pour debug
     * @returns {string}
     */
    toString() {
        return `Position(${this.path.join('.')}, offset: ${this.offset})`;
    }
}

/**
 * Gestionnaire de positions pour Codex
 * Gère la conversion entre positions DOM et positions abstraites
 */
export class CodexPositionManager {
    /** @param {import('./codex.svelte').Codex} codex */
    constructor(codex) {
        this.codex = codex;
    }

    /**
     * Convertit une position DOM en CodexPosition
     * @param {Node} container
     * @param {number} offset
     * @returns {CodexPosition|null}
     */
    fromDOM(container, offset) {
        if (!this.codex.element?.contains(container)) return null;

        // Trouver le bloc contenant
        const block = this.findBlockContaining(container);
        if (!block) return null;
        
        // Si le bloc gère sa propre conversion de position
        if (block.getPositionFromDOM) {
            return block.getPositionFromDOM(container, offset, block.path);
        }

        // Sinon, utiliser la logique par défaut
        return this.defaultPositionFromDOM(block, container, offset, block.path);
    }

    /**
     * Convertit une CodexPosition en position DOM
     * @param {CodexPosition} position
     * @returns {{container: Node, offset: number}|null}
     */
    toDOM(position) {
        const block = this.getBlockAtPath(position.path);
        if (!block) return null;

        // Si le bloc gère sa propre conversion
        if (block.getPositionToDOM) {
            return block.getPositionToDOM(position);
        }

        // Sinon, utiliser la logique par défaut
        return this.defaultPositionToDOM(block, position);
    }

    /**
     * Trouve le bloc contenant un nœud DOM
     * @param {Node} node
     * @returns {import('./block.svelte').Block|null}
     */
    findBlockContaining(node) {
        let current = node;
        
        while (current) {
            // Vérifier tous les blocs
            for (const block of this.codex.recursive) {
                if (block.element === current) {
                    return block;
                }
            }
            current = current.parentNode;
        }
        
        return null;
    }

    /**
     * Obtient le bloc à un chemin donné
     * @param {number[]} path
     * @returns {import('./block.svelte').Block|null}
     * 
     */
    getBlockAtPath(path) {
        let current = this.codex;
        
        for (const index of path) {
            if (current instanceof MegaBlock && current.children[index]) {
                current = current.children[index];
            } else {
                return null;
            }
        }
        
        return current;
    }

    /**
     * Logique par défaut pour convertir DOM -> Position
     * @private
     * @param {import('./block.svelte').Block} block
     * @param {Node} container
     * @param {number} offset
     * @param {number[]} blockPath
     */
    defaultPositionFromDOM(block, container, offset, blockPath) {
        // Pour un bloc simple, calculer l'offset depuis le début
        // console.log(`Calculating position for block at path ${blockPath.join('.')}, offset: ${offset}`);
        
        let totalOffset = 0;
        let found = false;

        const walker = document.createTreeWalker(
            block.element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            if (node === container) {
                totalOffset += offset;
                found = true;
                break;
            }
            totalOffset += node.textContent.length;
        }

        if (!found && container === block.element) {
            // Le container est l'élément lui-même
            totalOffset = offset;
            found = true;
        }

        return found ? new CodexPosition(blockPath, totalOffset, block) : null;
    }

    /**
     * Logique par défaut pour convertir Position -> DOM
     * @private
     * @param {import('./block.svelte').Block} block
     * @param {CodexPosition} position
     */
    defaultPositionToDOM(block, position) {
        if (!block.element) return null;

        let remainingOffset = position.offset;
        
        const walker = document.createTreeWalker(
            block.element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            const length = node.textContent.length;
            
            if (remainingOffset <= length) {
                return {
                    container: node,
                    offset: remainingOffset
                };
            }
            
            remainingOffset -= length;
        }

        // Si on arrive ici, l'offset dépasse le contenu
        // Retourner la fin du bloc
        return {
            container: block.element,
            offset: block.element.childNodes.length
        };
    }

    /**
     * Crée une plage entre deux positions
     * @param {CodexPosition} start
     * @param {CodexPosition} end
     * @returns {{start: CodexPosition, end: CodexPosition}}
     */
    createRange(start, end) {
        // S'assurer que start <= end
        if (start.compare(end) > 0) {
            return { start: end, end: start };
        }
        return { start, end };
    }

    /**
     * Vérifie si une position est dans une plage
     * @param {CodexPosition} position
     * @param {{start: CodexPosition, end: CodexPosition}} range
     * @returns {boolean}
     */
    isInRange(position, range) {
        return position.compare(range.start) >= 0 && 
               position.compare(range.end) <= 0;
    }
}