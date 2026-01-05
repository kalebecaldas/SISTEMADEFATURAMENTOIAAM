const { body, param, query, validationResult } = require('express-validator');
const logger = require('../services/logger');

// Middleware para processar resultados de validação
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn('Validation failed', {
            path: req.path,
            method: req.method,
            errors: errors.array(),
            body: req.body,
        });

        return res.status(400).json({
            error: 'Dados inválidos',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
                value: err.value,
            })),
        });
    }
    next();
};

// Validações comuns
const validations = {
    // Validar email
    email: () => body('email')
        .isEmail()
        .withMessage('Email inválido')
        .normalizeEmail(),

    // Validar senha
    password: (minLength = 6) => body('senha')
        .isLength({ min: minLength })
        .withMessage(`Senha deve ter no mínimo ${minLength} caracteres`),

    // Validar mês
    mes: () => [
        param('mes').optional(),
        body('mes').optional(),
        query('mes').optional(),
    ].map(validator =>
        validator
            .isInt({ min: 1, max: 12 })
            .withMessage('Mês deve ser entre 1 e 12')
    ),

    // Validar ano
    ano: () => [
        param('ano').optional(),
        body('ano').optional(),
        query('ano').optional(),
    ].map(validator =>
        validator
            .isInt({ min: 2020, max: 2100 })
            .withMessage('Ano inválido')
    ),

    // Validar ID
    id: (field = 'id') => param(field)
        .isInt({ min: 1 })
        .withMessage('ID inválido'),

    // Validar valor monetário
    valor: (field = 'valor') => body(field)
        .isFloat({ min: 0 })
        .withMessage('Valor deve ser um número positivo'),

    // Validar booleano
    boolean: (field) => body(field)
        .isBoolean()
        .withMessage(`${field} deve ser verdadeiro ou falso`),

    // Validar string não vazia
    notEmpty: (field, message) => body(field)
        .trim()
        .notEmpty()
        .withMessage(message || `${field} é obrigatório`),

    // Validar array
    array: (field, message) => body(field)
        .isArray()
        .withMessage(message || `${field} deve ser um array`),

    // Validar data
    date: (field) => body(field)
        .isISO8601()
        .withMessage('Data inválida'),

    // Validar arquivo
    file: (req, res, next) => {
        if (!req.file) {
            logger.warn('File validation failed', {
                path: req.path,
                method: req.method,
            });
            return res.status(400).json({
                error: 'Nenhum arquivo enviado',
            });
        }
        next();
    },
};

// Validações específicas para rotas

// Upload de planilha
const uploadPlanilhaValidation = [
    body('mes')
        .isInt({ min: 1, max: 12 })
        .withMessage('Mês deve ser entre 1 e 12'),
    body('ano')
        .isInt({ min: 2020, max: 2100 })
        .withMessage('Ano inválido'),
    body('sobrescrever')
        .optional()
        .isIn(['true', 'false'])
        .withMessage('Sobrescrever deve ser true ou false'),
    validate,
];

// Login
const loginValidation = [
    body('email')
        .isEmail()
        .withMessage('Email inválido')
        .normalizeEmail(),
    body('senha')
        .notEmpty()
        .withMessage('Senha é obrigatória'),
    validate,
];

// Criar/atualizar prestador
const prestadorValidation = [
    body('nome')
        .trim()
        .notEmpty()
        .withMessage('Nome é obrigatório')
        .isLength({ min: 3 })
        .withMessage('Nome deve ter no mínimo 3 caracteres'),
    body('email')
        .isEmail()
        .withMessage('Email inválido')
        .normalizeEmail(),
    body('senha')
        .optional()
        .isLength({ min: 6 })
        .withMessage('Senha deve ter no mínimo 6 caracteres'),
    validate,
];

// Atualizar status
const statusValidation = [
    body('ativo')
        .isBoolean()
        .withMessage('Status deve ser verdadeiro ou falso'),
    validate,
];

// Configurações
const configValidation = [
    body('configuracoes')
        .isObject()
        .withMessage('Configurações devem ser um objeto'),
    validate,
];

// Validar período (mês/ano)
const periodoValidation = [
    param('mes')
        .isInt({ min: 1, max: 12 })
        .withMessage('Mês deve ser entre 1 e 12'),
    param('ano')
        .isInt({ min: 2020, max: 2100 })
        .withMessage('Ano inválido'),
    validate,
];

// Validar paginação
const paginationValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Página deve ser um número positivo'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limite deve ser entre 1 e 100'),
    validate,
];

module.exports = {
    validate,
    validations,
    uploadPlanilhaValidation,
    loginValidation,
    prestadorValidation,
    statusValidation,
    configValidation,
    periodoValidation,
    paginationValidation,
};
