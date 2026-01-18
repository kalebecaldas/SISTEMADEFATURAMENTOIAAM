/**
 * Script de inicialização para Railway
 * Garante que o banco de dados está configurado antes de iniciar o servidor
 */

const { initDatabase } = require('./database/init');
const logger = require('./services/logger');

async function initializeRailway() {
    console.log('🚀 Iniciando aplicação no Railway...');
    console.log('📦 Ambiente:', process.env.NODE_ENV);
    console.log('🗄️  Banco de dados:', process.env.DATABASE_URL ? 'PostgreSQL (Railway)' : 'SQLite (Local)');

    try {
        // Inicializar banco de dados
        console.log('🔧 Inicializando banco de dados...');
        await initDatabase();

        console.log('✅ Banco de dados inicializado com sucesso!');
        console.log('🎯 Iniciando servidor...');

        // Iniciar o servidor
        require('./server.js');

    } catch (error) {
        console.error('❌ Erro ao inicializar aplicação:', error);
        logger.error('Railway initialization failed', error);
        process.exit(1);
    }
}

// Executar se for chamado diretamente
if (require.main === module) {
    initializeRailway();
}

module.exports = { initializeRailway };
