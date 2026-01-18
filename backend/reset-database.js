/**
 * Script para RESETAR o banco de dados
 * CUIDADO: Apaga TODOS os dados e recria do zero!
 * 
 * Uso:
 * - Local: node reset-database.js
 * - Railway: Ativar variável RESET_DATABASE=true e fazer redeploy
 */

const bcrypt = require('bcryptjs');

async function resetDatabase() {
    console.log('⚠️  INICIANDO RESET DO BANCO DE DADOS...');
    console.log('⚠️  TODOS OS DADOS SERÃO APAGADOS!\n');

    const db = require('./database/connection');

    try {
        // Lista de todas as tabelas (na ordem correta para evitar erros de FK)
        const tables = [
            'dados_mensais',
            'notas_fiscais',
            'comprovantes_pagamento',
            'vinculos_colaborador_contrato',
            'solicitacoes_cadastro',
            'contratos',
            'configuracoes',
            'usuarios'
        ];

        console.log('🗑️  Apagando tabelas existentes...');
        for (const table of tables) {
            try {
                await db.schema.dropTableIfExists(table);
                console.log(`   ✓ Tabela ${table} removida`);
            } catch (err) {
                console.log(`   - Tabela ${table} não existia`);
            }
        }

        console.log('\n📦 Recriando estrutura do banco...');

        // Recriar tabelas usando o initDatabase
        const { initDatabase } = require('./database/init');
        await initDatabase();

        console.log('\n👥 Recriando usuários padrão...');

        // Garantir que os usuários estão corretos
        await db('usuarios').del(); // Limpa qualquer usuário que possa ter sido criado

        // Criar Admin
        const adminHash = bcrypt.hashSync('admin123', 10);
        await db('usuarios').insert({
            email: 'admin@sistema.com',
            senha: adminHash,
            nome: 'Administrador',
            tipo: 'admin',
            ativo: true
        });
        console.log('   ✓ Admin criado: admin@sistema.com / admin123');

        // Criar Master
        const masterHash = bcrypt.hashSync('mxskqgltne', 10);
        await db('usuarios').insert({
            email: 'kalebe.caldas@hotmail.com',
            senha: masterHash,
            nome: 'Kalebe Caldas',
            tipo: 'master',
            ativo: true
        });
        console.log('   ✓ Master criado: kalebe.caldas@hotmail.com / mxskqgltne');

        // Verificar usuários criados
        const usuarios = await db('usuarios').select('email', 'nome', 'tipo');
        console.log('\n📋 Usuários no banco:');
        usuarios.forEach(u => {
            console.log(`   - ${u.email} (${u.tipo})`);
        });

        console.log('\n✅ RESET COMPLETO! Banco recriado com sucesso!');
        console.log('\n🔐 Credenciais de Acesso:');
        console.log('   Admin:  admin@sistema.com / admin123');
        console.log('   Master: kalebe.caldas@hotmail.com / mxskqgltne');

    } catch (error) {
        console.error('\n❌ ERRO AO RESETAR BANCO:', error);
        throw error;
    } finally {
        await db.destroy();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    resetDatabase()
        .then(() => {
            console.log('\n✨ Pronto!');
            process.exit(0);
        })
        .catch(err => {
            console.error('\n💥 Falhou:', err);
            process.exit(1);
        });
}

module.exports = { resetDatabase };
