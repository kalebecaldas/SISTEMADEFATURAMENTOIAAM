const { db } = require('./database/init');

/**
 * Script para limpar dados de prestadores e planilhas
 * Mantém apenas o usuário admin
 */
async function limparDados() {
    try {
        console.log('🧹 Iniciando limpeza de dados...\n');

        // 1. Deletar dados mensais
        const dadosMensaisDeletados = await db('dados_mensais').del();
        console.log(`✅ ${dadosMensaisDeletados} registros deletados de dados_mensais`);

        // 2. Deletar notas fiscais
        const notasDeletadas = await db('notas_fiscais').del();
        console.log(`✅ ${notasDeletadas} registros deletados de notas_fiscais`);

        // 3. Deletar documentos de prestadores
        const documentosDeletados = await db('documentos_prestador').del();
        console.log(`✅ ${documentosDeletados} registros deletados de documentos_prestador`);

        // 4. Deletar solicitações de documentos
        const solicitacoesDeletadas = await db('solicitacoes_documentos').del();
        console.log(`✅ ${solicitacoesDeletadas} registros deletados de solicitacoes_documentos`);

        // 5. Deletar contratos gerados
        const contratosDeletados = await db('contratos_gerados').del();
        console.log(`✅ ${contratosDeletados} registros deletados de contratos_gerados`);

        // 6. Deletar prestadores (manter apenas admin)
        const prestadoresDeletados = await db('usuarios')
            .where('tipo', '!=', 'admin')
            .del();
        console.log(`✅ ${prestadoresDeletados} prestadores deletados`);

        // 7. Verificar usuários restantes
        const usuariosRestantes = await db('usuarios').select('id', 'nome', 'email', 'tipo');
        console.log('\n📋 Usuários restantes no sistema:');
        usuariosRestantes.forEach(u => {
            console.log(`   - ${u.nome} (${u.email}) - ${u.tipo}`);
        });

        console.log('\n✅ Limpeza concluída com sucesso!');
        console.log('🎯 Sistema pronto para receber nova planilha\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao limpar dados:', error);
        process.exit(1);
    }
}

// Executar limpeza
limparDados();
