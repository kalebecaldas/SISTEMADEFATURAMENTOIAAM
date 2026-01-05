const logger = require('../services/logger');
const emailService = require('../services/emailService');

// Classe de erro customizada
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }
}

// Middleware de tratamento de erros
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    error.stack = err.stack;

    // Log do erro
    logger.error('Error occurred', err, {
        path: req.path,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query,
        user: req.user ? req.user.email : 'anonymous',
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });

    // Erros de validação do Mongoose/Knex
    if (err.name === 'ValidationError') {
        error.message = 'Erro de validação';
        error.statusCode = 400;
    }

    // Erro de duplicação (unique constraint)
    if (err.code === 'SQLITE_CONSTRAINT' || err.code === '23505') {
        error.message = 'Registro duplicado';
        error.statusCode = 409;
    }

    // Erro de JWT
    if (err.name === 'JsonWebTokenError') {
        error.message = 'Token inválido';
        error.statusCode = 401;
    }

    // Erro de JWT expirado
    if (err.name === 'TokenExpiredError') {
        error.message = 'Token expirado';
        error.statusCode = 401;
    }

    // Erro de multer (upload)
    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            error.message = 'Arquivo muito grande';
            error.statusCode = 413;
        } else {
            error.message = 'Erro no upload do arquivo';
            error.statusCode = 400;
        }
    }

    // Erro de banco de dados
    if (err.code && err.code.startsWith('SQLITE_')) {
        error.message = 'Erro no banco de dados';
        error.statusCode = 500;
    }

    // Enviar alerta por email para erros críticos em produção
    if (
        process.env.NODE_ENV === 'production' &&
        error.statusCode >= 500 &&
        emailService.isConfigurado()
    ) {
        emailService.enviarAlertaErro(error, req).catch(emailErr => {
            logger.error('Failed to send error alert email', emailErr);
        });
    }

    // Resposta para o cliente
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erro interno do servidor';

    // Em desenvolvimento, enviar stack trace
    const response = {
        error: message,
        timestamp: error.timestamp || new Date().toISOString(),
    };

    if (process.env.NODE_ENV === 'development') {
        response.stack = error.stack;
        response.details = error;
    }

    res.status(statusCode).json(response);
};

// Middleware para capturar erros assíncronos
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Middleware para rotas não encontradas
const notFound = (req, res, next) => {
    const error = new AppError(`Rota não encontrada: ${req.originalUrl}`, 404);
    next(error);
};

// Validar ambiente de produção
const validateEnvironment = () => {
    const requiredEnvVars = ['JWT_SECRET', 'PORT'];
    const missing = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
        logger.error('Missing required environment variables', null, {
            missing,
        });
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Avisos para variáveis opcionais
    const optionalEnvVars = ['EMAIL_USER', 'EMAIL_PASS'];
    const missingOptional = optionalEnvVars.filter(varName => !process.env[varName]);

    if (missingOptional.length > 0) {
        logger.warn('Missing optional environment variables', {
            missing: missingOptional,
            impact: 'Email functionality will be disabled',
        });
    }
};

module.exports = {
    AppError,
    errorHandler,
    asyncHandler,
    notFound,
    validateEnvironment,
};
