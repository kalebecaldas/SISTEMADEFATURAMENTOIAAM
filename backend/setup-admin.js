#!/usr/bin/env node

/**
 * Script para criar usuário admin
 * Uso: node setup-admin.js
 */

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const ADMIN_EMAIL = 'kalebe.caldas@hotmail.com';
const ADMIN_PASSWORD = 'mxskqgltne';
const ADMIN_NAME = 'Kalebe Caldas';

async function createAdmin() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('🔌 Conectando ao banco de dados...');
        await client.connect();
        console.log('✅ Conectado!');

        // Verificar se admin já existe
        const checkResult = await client.query(
            'SELECT id, email FROM usuarios WHERE email = $1',
            [ADMIN_EMAIL]
        );

        if (checkResult.rows.length > 0) {
            console.log('ℹ️  Admin já existe:', ADMIN_EMAIL);
            console.log('   ID:', checkResult.rows[0].id);

            // Atualizar senha
            const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
            await client.query(
                'UPDATE usuarios SET senha = $1, tipo = $2, ativo = $3 WHERE email = $4',
                [passwordHash, 'admin', true, ADMIN_EMAIL]
            );
            console.log('✅ Senha atualizada!');
        } else {
            console.log('📝 Criando novo admin...');
            const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);

            const insertResult = await client.query(
                'INSERT INTO usuarios (email, senha, nome, tipo, ativo, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id',
                [ADMIN_EMAIL, passwordHash, ADMIN_NAME, 'admin', true]
            );

            console.log('✅ Admin criado com sucesso!');
            console.log('   ID:', insertResult.rows[0].id);
        }

        console.log('\n📋 Credenciais:');
        console.log('   Email:', ADMIN_EMAIL);
        console.log('   Senha:', ADMIN_PASSWORD);

    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('\n✅ Concluído!');
    }
}

createAdmin();
