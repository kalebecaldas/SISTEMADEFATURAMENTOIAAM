/**
 * Mapeamento e normalização de unidades
 */

// Mapeamento de abreviações para nomes completos
const UNIDADES_MAP = {
    'ANEXO': 'ANEXO',
    'MATRIZ': 'MATRIZ',
    'SJ': 'SÃO JOSÉ',
    'SAO JOSE': 'SÃO JOSÉ',
    'SÃO JOSÉ': 'SÃO JOSÉ',
    'SAOjose': 'SÃO JOSÉ',
    'S.J': 'SÃO JOSÉ',
    'S.JOSE': 'SÃO JOSÉ'
};

// Lista de unidades válidas
const UNIDADES_VALIDAS = [
    'ANEXO',
    'MATRIZ',
    'SÃO JOSÉ'
];

/**
 * Normaliza o nome da unidade
 * @param {string} unidade - Nome ou abreviação da unidade
 * @returns {string} - Nome normalizado da unidade
 */
function normalizarUnidade(unidade) {
    if (!unidade || typeof unidade !== 'string') {
        return null;
    }

    const unidadeUpper = unidade.trim().toUpperCase();

    // Tentar encontrar no mapeamento
    if (UNIDADES_MAP[unidadeUpper]) {
        return UNIDADES_MAP[unidadeUpper];
    }

    // Se não encontrou, retornar o valor original normalizado
    return unidade.trim();
}

/**
 * Verifica se a unidade é válida
 * @param {string} unidade - Nome da unidade
 * @returns {boolean} - True se válida
 */
function isUnidadeValida(unidade) {
    const normalizada = normalizarUnidade(unidade);
    return UNIDADES_VALIDAS.includes(normalizada);
}

/**
 * Adiciona uma nova unidade ao sistema
 * @param {string} unidade - Nome da nova unidade
 * @param {string[]} abreviacoes - Array de abreviações opcionais
 */
function adicionarUnidade(unidade, abreviacoes = []) {
    const unidadeNormalizada = unidade.trim().toUpperCase();

    if (!UNIDADES_VALIDAS.includes(unidadeNormalizada)) {
        UNIDADES_VALIDAS.push(unidadeNormalizada);
    }

    // Adicionar a própria unidade ao mapa
    UNIDADES_MAP[unidadeNormalizada] = unidadeNormalizada;

    // Adicionar abreviações
    abreviacoes.forEach(abrev => {
        UNIDADES_MAP[abrev.trim().toUpperCase()] = unidadeNormalizada;
    });

    console.log(`✅ Unidade adicionada: ${unidadeNormalizada}`);
    if (abreviacoes.length > 0) {
        console.log(`   Abreviações: ${abreviacoes.join(', ')}`);
    }
}

/**
 * Lista todas as unidades cadastradas
 * @returns {string[]} - Array com todas as unidades
 */
function listarUnidades() {
    return [...UNIDADES_VALIDAS];
}

module.exports = {
    normalizarUnidade,
    isUnidadeValida,
    adicionarUnidade,
    listarUnidades,
    UNIDADES_VALIDAS
};
