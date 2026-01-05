const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Definir níveis de log customizados
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Definir cores para cada nível
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

winston.addColors(colors);

// Formato para console (desenvolvimento)
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
    )
);

// Formato para arquivo (produção)
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Transports
const transports = [
    // Console para desenvolvimento
    new winston.transports.Console({
        format: consoleFormat,
    }),

    // Arquivo para todos os logs
    new DailyRotateFile({
        filename: path.join(__dirname, '../logs/application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: fileFormat,
    }),

    // Arquivo separado para erros
    new DailyRotateFile({
        filename: path.join(__dirname, '../logs/error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        level: 'error',
        format: fileFormat,
    }),
];

// Criar logger
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    levels,
    transports,
});

// Métodos auxiliares para logging estruturado
class Logger {
    constructor() {
        this.logger = logger;
    }

    // Log de informação
    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    // Log de erro
    error(message, error = null, meta = {}) {
        if (error instanceof Error) {
            this.logger.error(message, {
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                },
                ...meta,
            });
        } else {
            this.logger.error(message, meta);
        }
    }

    // Log de aviso
    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    // Log de debug
    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    // Log de requisição HTTP
    http(message, meta = {}) {
        this.logger.http(message, meta);
    }

    // Log de operação de banco de dados
    database(operation, table, meta = {}) {
        this.logger.info(`[DATABASE] ${operation} on ${table}`, meta);
    }

    // Log de email
    email(action, recipient, meta = {}) {
        this.logger.info(`[EMAIL] ${action} to ${recipient}`, meta);
    }

    // Log de autenticação
    auth(action, user, meta = {}) {
        this.logger.info(`[AUTH] ${action} - User: ${user}`, meta);
    }

    // Log de upload
    upload(filename, user, meta = {}) {
        this.logger.info(`[UPLOAD] File: ${filename} by User: ${user}`, meta);
    }

    // Log de scheduler
    scheduler(job, status, meta = {}) {
        this.logger.info(`[SCHEDULER] Job: ${job} - Status: ${status}`, meta);
    }

    // Log de auditoria
    audit(action, user, entity, meta = {}) {
        this.logger.info(`[AUDIT] ${action} by ${user} on ${entity}`, {
            timestamp: new Date().toISOString(),
            ...meta,
        });
    }
}

module.exports = new Logger();
