/**
 * Script de teste para o serviço de email
 * 
 * Como usar:
 * 1. Configure EMAIL_USER e EMAIL_PASS no arquivo .env
 * 2. Execute: node tests/testEmail.js
 */

require('dotenv').config();
const emailService = require('../services/emailService');
const logger = require('../services/logger');

async function testarEmail() {
    console.log('\n📧 Testando Serviço de Email\n');
    console.log('='.repeat(50));

    // 1. Verificar configuração
    console.log('\n1️⃣ Verificando configuração...');
    if (!emailService.isConfigurado()) {
        console.log('❌ Email não configurado!');
        console.log('   Configure EMAIL_USER e EMAIL_PASS no arquivo .env');
        process.exit(1);
    }
    console.log('✅ Email configurado');

    // 2. Testar conexão SMTP
    console.log('\n2️⃣ Testando conexão SMTP...');
    const conexaoResult = await emailService.testarConexao();
    if (!conexaoResult.success) {
        console.log('❌ Falha na conexão SMTP');
        console.log('   Erro:', conexaoResult.error);
        console.log('\n💡 Verifique:');
        console.log('   - EMAIL_USER está correto?');
        console.log('   - EMAIL_PASS é uma senha de app (não a senha normal)?');
        console.log('   - Autenticação de 2 fatores está ativa?');
        process.exit(1);
    }
    console.log('✅ Conexão SMTP estabelecida');

    // 3. Testar envio de email de confirmação de upload
    console.log('\n3️⃣ Testando email de confirmação de upload...');
    try {
        const resultado = await emailService.enviarConfirmacaoUpload(
            process.env.EMAIL_USER,
            {
                total: 10,
                sucessos: 9,
                erros: 1,
                mes: 11,
                ano: 2025,
            }
        );

        if (resultado) {
            console.log('✅ Email de confirmação enviado com sucesso');
            console.log(`   Verifique sua caixa de entrada: ${process.env.EMAIL_USER}`);
        } else {
            console.log('❌ Falha ao enviar email de confirmação');
        }
    } catch (error) {
        console.log('❌ Erro ao enviar email:', error.message);
    }

    // 4. Testar email de boas-vindas
    console.log('\n4️⃣ Testando email de boas-vindas...');
    try {
        const resultado = await emailService.enviarBoasVindas(
            process.env.EMAIL_USER,
            'Teste Usuário',
            '123456'
        );

        if (resultado) {
            console.log('✅ Email de boas-vindas enviado com sucesso');
        } else {
            console.log('❌ Falha ao enviar email de boas-vindas');
        }
    } catch (error) {
        console.log('❌ Erro ao enviar email:', error.message);
    }

    // 5. Testar email de lembrete
    console.log('\n5️⃣ Testando email de lembrete de nota fiscal...');
    try {
        const resultado = await emailService.enviarLembreteNotaFiscal(
            process.env.EMAIL_USER,
            'Teste Prestador',
            {
                mes: 11,
                ano: 2025,
                prazo: '15/11/2025',
            }
        );

        if (resultado) {
            console.log('✅ Email de lembrete enviado com sucesso');
        } else {
            console.log('❌ Falha ao enviar email de lembrete');
        }
    } catch (error) {
        console.log('❌ Erro ao enviar email:', error.message);
    }

    console.log('\n' + '='.repeat(50));
    console.log('\n✅ Testes concluídos!');
    console.log('\n💡 Verifique sua caixa de entrada para confirmar o recebimento dos emails.');
    console.log('\n');
}

// Executar testes
testarEmail().catch(error => {
    console.error('\n❌ Erro durante os testes:', error);
    process.exit(1);
});
