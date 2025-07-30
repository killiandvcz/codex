/**
* Utilitaire réactif pour gérer la sélection de texte avec Svelte 5 runes
* @example
* const selection = new SvelteSelection();
* // Utiliser selection.text, selection.isCollapsed, etc. dans vos composants
*/
export class SvelteSelection {
    constructor() {
        // Utilisation d'un effect root pour éviter les fuites mémoire
        this.#cleanup = $effect.root(() => {
            $effect(() => {
                // Vérification de la disponibilité de l'API
                if (typeof window === 'undefined' || !window.getSelection) {
                    return;
                }
                
                document.addEventListener('selectionchange', this.#updateSelection);
                this.#updateSelection();
                
                return () => {
                    document.removeEventListener('selectionchange', this.#updateSelection);
                    this.#cleanup?.();
                };
            });
        });
    }
    
    /** @type {Function?} */
    #cleanup = null;
    
    /** @type {Selection?} */
    raw = null;
    
    /** 
    * État interne de la sélection
    * @type {{
    *   anchorNode: Node | null,
    *   anchorOffset: number,
    *   focusNode: Node | null,
    *   focusOffset: number,
    *   isCollapsed: boolean,
    *   rangeCount: number,
    *   type: string,
    *   direction: string,
    *   text: string,
    *   html: string
    * }?} 
    */
    #sel = $state(null);
    is = $derived(!!this.#sel);
    
    /** @type {Range[]} */
    #ranges = $state([]);

    // Propriétés réactives de base
    anchorNode = $derived(this.#sel?.anchorNode ?? null);
    anchorOffset = $derived(this.#sel?.anchorOffset ?? 0);
    focusNode = $derived(this.#sel?.focusNode ?? null);
    focusOffset = $derived(this.#sel?.focusOffset ?? 0);
    isCollapsed = $derived(this.#sel?.isCollapsed ?? true);
    rangeCount = $derived(this.#sel?.rangeCount ?? 0);
    type = $derived(this.#sel?.type ?? '');
    direction = $derived(this.#sel?.direction ?? 'none');

    startOffset = $derived(this.direction === 'forward' ? this.anchorOffset : this.focusOffset);
    endOffset = $derived(this.direction === 'backward' ? this.anchorOffset : this.focusOffset);
    
    // Propriétés des ranges
    ranges = $derived(this.#ranges);
    firstRange = $derived(this.#ranges[0] ?? null);
    get range() {
        // Retourne la première range si elle existe, sinon null
        return this.firstRange;
    }
    lastRange = $derived(this.#ranges[this.#ranges.length - 1] ?? null);
    
    // Propriétés dérivées utiles
    text = $derived(this.#sel?.text ?? '');
    html = $derived(this.#sel?.html ?? '');
    hasSelection = $derived(!this.isCollapsed && this.rangeCount > 0);
    isEmpty = $derived(this.text.length === 0);
    hasMultipleRanges = $derived(this.#ranges.length > 1);
    
    // Informations sur les éléments contenants
    commonAncestor = $derived.by(() => {
        if (!this.hasSelection || this.rangeCount === 0) return null;
        try {
            const range = this.firstRange;
            return range?.commonAncestorContainer ?? null;
        } catch {
            return null;
        }
    });
    
    // Informations dérivées des ranges
    allText = $derived.by(() => {
        return this.#ranges.map(range => range.toString()).join('');
    });
    
    allHtml = $derived.by(() => {
        return this.#ranges.map(range => {
            try {
                const fragment = range.cloneContents();
                const div = document.createElement('div');
                div.appendChild(fragment);
                return div.innerHTML;
            } catch {
                return '';
            }
        }).join('');
    });
    
    // Bounding rectangles de toutes les ranges
    boundingRects = $derived.by(() => {
        return this.#ranges.map(range => {
            try {
                return range.getBoundingClientRect();
            } catch {
                return null;
            }
        }).filter(rect => rect !== null);
    });
    
    // Méthode privée pour mettre à jour la sélection
    #updateSelection = () => {
        try {
            this.raw = window.getSelection();
            
            if (!this.raw) {
                this.#sel = null;
                this.#ranges = [];
                return;
            }
            
            // Mise à jour des ranges
            const newRanges = [];
            for (let i = 0; i < this.raw.rangeCount; i++) {
                try {
                    const range = this.raw.getRangeAt(i);
                    newRanges.push(range);
                } catch (error) {
                    console.warn(`Erreur lors de la récupération de la range ${i}:`, error);
                }
            }
            this.#ranges = newRanges;
            
            // Extraction du texte et HTML si une sélection existe
            let text = '';
            let html = '';
            
            if (this.raw.rangeCount > 0 && !this.raw.isCollapsed) {
                try {
                    const range = this.raw.getRangeAt(0);
                    text = range.toString();
                    
                    // Extraction du HTML
                    const fragment = range.cloneContents();
                    const div = document.createElement('div');
                    div.appendChild(fragment);
                    html = div.innerHTML;
                } catch (error) {
                    console.warn('Erreur lors de l\'extraction du contenu de la sélection:', error);
                }
            }
            
            this.#sel = {
                anchorNode: this.raw.anchorNode,
                anchorOffset: this.raw.anchorOffset,
                focusNode: this.raw.focusNode,
                focusOffset: this.raw.focusOffset,
                isCollapsed: this.raw.isCollapsed,
                rangeCount: this.raw.rangeCount,
                type: this.raw.type,
                direction: this.raw.direction || 'none',
                text,
                html
            };
        } catch (error) {
            console.error('Erreur lors de la mise à jour de la sélection:', error);
            this.#sel = null;
            this.#ranges = [];
        }
    };
    
    // Méthodes de manipulation de la sélection avec gestion d'erreurs
    
    /** 
    * Ajoute une range à la sélection.
    * @param {Range} range - La range à ajouter.
    * @returns {boolean} True si l'opération a réussi
    */
    addRange = (range) => {
        try {
            this.raw?.addRange(range);
            return true;
        } catch (error) {
            console.warn('Erreur lors de l\'ajout de la range:', error);
            return false;
        }
    };
    
    /** 
    * Supprime toutes les ranges de la sélection.
    * @returns {boolean} True si l'opération a réussi
    */
    removeAllRanges = () => {
        try {
            this.raw?.removeAllRanges();
            return true;
        } catch (error) {
            console.warn('Erreur lors de la suppression des ranges:', error);
            return false;
        }
    };
    
    /** 
    * Supprime une range spécifique de la sélection.
    * @param {Range} range - La range à supprimer.
    * @returns {boolean} True si l'opération a réussi
    */
    removeRange = (range) => {
        try {
            this.raw?.removeRange(range);
            return true;
        } catch (error) {
            console.warn('Erreur lors de la suppression de la range:', error);
            return false;
        }
    };
    
    /**
    * Récupère la range à l'index spécifié.
    * @param {number} index - L'index de la range à récupérer.
    * @returns {Range|null} La range à l'index spécifié, ou null si elle n'existe pas.
    */
    getRangeAt = (index) => {
        try {
            return this.raw?.getRangeAt(index) ?? null;
        } catch (error) {
            console.warn('Erreur lors de la récupération de la range:', error);
            return null;
        }
    };
    
    /**
    * Réduit la sélection à un nœud et offset spécifiques.
    * @param {Node} node - Le nœud vers lequel réduire la sélection.
    * @param {number} offset - L'offset dans le nœud.
    * @returns {boolean} True si l'opération a réussi
    */
    collapse = (node, offset = 0) => {
        try {
            this.raw?.collapse(node, offset);
            return true;
        } catch (error) {
            console.warn('Erreur lors de la réduction de la sélection:', error);
            return false;
        }
    };
    
    /**
    * Réduit la sélection au début de la range courante.
    * @returns {boolean} True si l'opération a réussi
    */
    collapseToStart = () => {
        try {
            this.raw?.collapseToStart();
            return true;
        } catch (error) {
            console.warn('Erreur lors de la réduction au début:', error);
            return false;
        }
    };
    
    /**
    * Réduit la sélection à la fin de la range courante.
    * @returns {boolean} True si l'opération a réussi
    */
    collapseToEnd = () => {
        try {
            this.raw?.collapseToEnd();
            return true;
        } catch (error) {
            console.warn('Erreur lors de la réduction à la fin:', error);
            return false;
        }
    };
    
    /**
    * Sélectionne le contenu d'un nœud.
    * @param {Node} node - Le nœud dont le contenu doit être sélectionné.
    * @returns {boolean} True si l'opération a réussi
    */
    selectAllChildren = (node) => {
        try {
            this.raw?.selectAllChildren(node);
            return true;
        } catch (error) {
            console.warn('Erreur lors de la sélection des enfants:', error);
            return false;
        }
    };
    
    /**
    * Étend la sélection vers un nœud et offset spécifiques.
    * @param {Node} node - Le nœud vers lequel étendre.
    * @param {number} offset - L'offset dans le nœud.
    * @returns {boolean} True si l'opération a réussi
    */
    extend = (node, offset = 0) => {
        try {
            this.raw?.extend(node, offset);
            return true;
        } catch (error) {
            console.warn('Erreur lors de l\'extension de la sélection:', error);
            return false;
        }
    };
    
    /**
    * Définit la base et l'extension de la sélection.
    * @param {Node} anchorNode - Le nœud d'ancrage.
    * @param {number} anchorOffset - L'offset d'ancrage.
    * @param {Node} focusNode - Le nœud de focus.
    * @param {number} focusOffset - L'offset de focus.
    * @returns {boolean} True si l'opération a réussi
    
    */
    setBaseAndExtent = (anchorNode, anchorOffset, focusNode, focusOffset) => {
        try {
            this.raw?.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
            return true;
        } catch (error) {
            console.warn('Erreur lors de la définition de la base et extension:', error);
            return false;
        }
    };
    
    /**
    * Vérifie si la sélection contient un nœud donné.
    * @param {Node} node - Le nœud à vérifier.
    * @param {boolean} allowPartialContainment - Permet la contenance partielle.
    * @returns {boolean} True si le nœud est contenu dans la sélection.
    */
    containsNode = (node, allowPartialContainment = false) => {
        try {
            return this.raw?.containsNode(node, allowPartialContainment) ?? false;
        } catch (error) {
            console.warn('Erreur lors de la vérification de contenance:', error);
            return false;
        }
    };
    
    /**
    * Crée une nouvelle range basée sur la sélection courante.
    * @returns {Range|null} Une nouvelle range ou null.
    */
    createRange = () => {
        try {
            if (!this.hasSelection) return null;
            return this.firstRange?.cloneRange() ?? null;
        } catch (error) {
            console.warn('Erreur lors de la création de la range:', error);
            return null;
        }
    };
    
    /**
    * Crée des copies de toutes les ranges courantes.
    * @returns {Range[]} Un array de toutes les ranges clonées.
    */
    createAllRanges = () => {
        try {
            return this.#ranges.map(range => range.cloneRange());
        } catch (error) {
            console.warn('Erreur lors de la création des ranges:', error);
            return [];
        }
    };
    
    /**
    * Récupère les coordonnées de toutes les ranges.
    * @returns {DOMRect[]} Un array des rectangles de toutes les ranges.
    */
    getAllBoundingRects = () => {
        return this.boundingRects;
    };
    
    /**
    * Vérifie si toutes les ranges sont dans un élément donné.
    * @param {Element} element - L'élément à vérifier.
    * @returns {boolean} True si toutes les ranges sont contenues.
    */
    allRangesInElement = (element) => {
        return this.#ranges.every(range => {
            try {
                return element.contains(range.commonAncestorContainer);
            } catch {
                return false;
            }
        });
    };
    
    /**
    * Filtre les ranges selon un prédicat.
    * @param {function(Range): boolean} predicate - Fonction de filtre.
    * @returns {Range[]} Les ranges qui passent le filtre.
    */
    filterRanges = (predicate) => {
        return this.#ranges.filter(predicate);
    };
    
    /**
    * Sélectionne tout le contenu du document.
    * @returns {boolean} True si l'opération a réussi
    */
    selectAll = () => {
        try {
            this.raw?.selectAllChildren(document.body);
            return true;
        } catch (error) {
            console.warn('Erreur lors de la sélection de tout:', error);
            return false;
        }
    };
    
    /**
    * Efface la sélection courante.
    * @returns {boolean} True si l'opération a réussi
    */
    clear = () => {
        return this.removeAllRanges();
    };
    
    /**
    * Nettoie les ressources utilisées par l'instance.
    * À appeler lors de la destruction du composant.
    */
    destroy = () => {
        this.#cleanup?.();
        this.raw = null;
        this.#sel = null;
        this.#ranges = [];
    };
}