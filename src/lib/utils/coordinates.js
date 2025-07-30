/**
* Parse une chaîne de coordonnées au format "x.y.z.w.v" ou "x.y.z.w.v (data)"
* @param {string} coordString - La chaîne à parser
* @returns {{
*   coordinates: number[], // Tableau de nombres représentant les coordonnées
*   specialData: string | number | null // Données optionnelles entre parent
* }} Objet contenant les coordonnées et les données spéciales
*/
export function parseCoordinates(coordString) {
    // Expression régulière pour capturer les coordonnées et les données optionnelles
    const regex = /^([\d.]+)(?:\s*\(([^)]+)\))?$/;
    const match = coordString.trim().match(regex);
    
    if (!match) {
        throw new Error(`Format de coordonnées invalide: "${coordString}"`);
    }
    
    const [, coordsPart, specialData] = match;
    
    // Parser les coordonnées
    const coordinates = coordsPart
    .split('.')
    .map(coord => {
        const num = Number(coord);
        if (isNaN(num)) {
            throw new Error(`Coordonnée invalide: "${coord}"`);
        }
        return num;
    });
    
    // Traiter les données spéciales
    let parsedSpecialData = null;
    if (specialData !== undefined) {
        // Essayer de convertir en nombre si possible
        const asNumber = Number(specialData);
        parsedSpecialData = isNaN(asNumber) ? specialData : asNumber;
    }
    
    return {
        coordinates,
        specialData: parsedSpecialData
    };
}

// Version alternative avec destructuring pour récupérer directement
/**
* 
* @param {string} coordString - La chaîne à parser
* @returns 
*/
export function parseCoordinatesDestructured(coordString) {
    const { coordinates, specialData } = parseCoordinates(coordString);
    return [coordinates, specialData];
}

// Version plus flexible avec validation optionnelle
/**
* 
* @param {string} coordString - La chaîne à parser
* @param {{ minCoords?: number, maxCoords?: number, allowNegative?: boolean }} options - Options de validation
* @returns 
*/
export function parseCoordinatesAdvanced(coordString, options = {}) {
    const { 
        minCoords = 1, 
        maxCoords = Infinity,
        allowNegative = false 
    } = options;
    
    const result = parseCoordinates(coordString);
    
    // Validations supplémentaires
    if (result.coordinates.length < minCoords) {
        throw new Error(`Au moins ${minCoords} coordonnées requises`);
    }
    
    if (result.coordinates.length > maxCoords) {
        throw new Error(`Maximum ${maxCoords} coordonnées autorisées`);
    }
    
    if (!allowNegative && result.coordinates.some(c => c < 0)) {
        throw new Error('Les coordonnées négatives ne sont pas autorisées');
    }
    
    return result;
}