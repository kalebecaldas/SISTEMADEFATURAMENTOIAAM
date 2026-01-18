/**
 * Script de start que verifica se deve resetar o banco antes de iniciar
 * Controle via variável de ambiente: RESET_DATABASE=true
 */

async function start() {
    console.log('🚀 Iniciando aplicação...\n');

    // Verificar se deve resetar o banco
    const shouldReset = process.env.RESET_DATABASE === 'true';

    if (shouldReset) {
        console.log('⚠️  FLAG DE RESET DETECTADA!');
        console.log('⚠️  RESET_DATABASE=true');
        console.log('⚠️  O banco será RESETADO!\n');

        const { resetDatabase } = require('./reset-database');
        await resetDatabase();

        console.log('\n⚠️  IMPORTANTE: Remova a variável RESET_DATABASE no Railway!');
        console.log('⚠️  Ou altere para RESET_DATABASE=false\n');
    } else {
        console.log('✓ Nenhum reset solicitado');
        console.log('✓ Inicializando banco normalmente...\n');

        // Inicialização normal
        const { initDatabase } = require('./database/init');
        await initDatabase();
    }

    console.log('✓ Banco pronto!');
    console.log('✓ Iniciando servidor...\n');

    // Iniciar o servidor
    require('./server.js');
}

start().catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
});
