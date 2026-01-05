const { db } = require('../init');
const bcrypt = require('bcryptjs');

/**
 * Adicionar tipo 'master' e criar usuário master
 */
async function adicionarTipoMaster() {
    console.log('🔧 Configurando permissões de usuário master...');

    try {
        // Criar usuário master
        const masterEmail = 'kalebe.caldas@hotmail.com';
        const existingMaster = await db('usuarios').where({ email: masterEmail }).first();

        if (!existingMaster) {
            const senhaHash = bcrypt.hashSync('Admin1073', 10);
            await db('usuarios').insert({
                email: masterEmail,
                senha: senhaHash,
                nome: 'Kalebe Caldas',
                tipo: 'master',
                ativo: true
            });
            console.log('✅ Usuário master criado:', masterEmail);
        } else {
            // Atualizar para master se já existir
            await db('usuarios')
                .where({ email: masterEmail })
                .update({ tipo: 'master' });
            console.log('✅ Usuário atualizado para master:', masterEmail);
        }

        // Garantir que admin padrão seja tipo 'admin'
        await db('usuarios')
            .where({ email: 'admin@sistema.com' })
            .update({ tipo: 'admin' });
        console.log('✅ Admin padrão configurado');

        console.log('✅ Configuração de permissões concluída!');
    } catch (error) {
        console.error('❌ Erro ao configurar permissões:', error.message);
        throw error;
    }
}

module.exports = {
    adicionarTipoMaster
};
