// Mapeamento de especialidades abreviadas para nomes completos
const ESPECIALIDADES_MAP = {
    'Acup': 'Acupuntura',
    'fisio pelv': 'Fisioterapia Pélvica',
    'neuro': 'Fisioterapia Neurológica',
    'SJAcup': 'Acupuntura São José',
    'SJFisio': 'Fisioterapia São José'
};

// Mapeamento de unidades baseado na especialidade
const UNIDADES_POR_ESPECIALIDADE = {
    'Acupuntura': ['Matriz'],
    'Fisioterapia Pélvica': ['Matriz'],
    'Fisioterapia Neurológica': ['Matriz'],
    'Acupuntura São José': ['São José'],
    'Fisioterapia São José': ['São José']
};

/**
 * Normaliza o nome da especialidade
 */
function normalizarEspecialidade(especialidadeAbreviada) {
    if (!especialidadeAbreviada) return null;

    const especialidade = ESPECIALIDADES_MAP[especialidadeAbreviada.trim()];
    return especialidade || especialidadeAbreviada.trim();
}

/**
 * Determina as unidades baseado na especialidade
 */
function determinarUnidades(especialidade) {
    if (!especialidade) return ['Matriz'];

    const unidades = UNIDADES_POR_ESPECIALIDADE[especialidade];
    return unidades || ['Matriz'];
}

module.exports = {
    ESPECIALIDADES_MAP,
    UNIDADES_POR_ESPECIALIDADE,
    normalizarEspecialidade,
    determinarUnidades
};
