/**
 * Script para popular os modelos de contratos iniciais
 * Execute: node backend/database/populateContratos.js
 */

require('dotenv').config();
const { db } = require('./init');
const { adicionarTabelasContratos } = require('./migrations/contratos');
const path = require('path');
const fs = require('fs');

const modelos = [
    {
        nome: 'Acupuntura - Matriz',
        tipo: 'profissional',
        especialidade: 'Acupuntura',
        unidade: 'Matriz',
        arquivo_path: path.join(__dirname, '../../CONTRATOS/Novo Padrão - Acup - Mtz.doc'),
        campos_json: JSON.stringify({
            campos: ['nome', 'endereco', 'cpf', 'data_assinatura', 'dia_pagamento', 'campo_custom'],
            campos_opcionais: ['campo_custom']
        }),
        ativo: true
    },
    {
        nome: 'Acupuntura - São José',
        tipo: 'profissional',
        especialidade: 'Acupuntura',
        unidade: 'São José',
        arquivo_path: path.join(__dirname, '../../CONTRATOS/Novo Padrão - Acup - SJ.doc'),
        campos_json: JSON.stringify({
            campos: ['nome', 'endereco', 'cpf', 'data_assinatura', 'dia_pagamento', 'campo_custom'],
            campos_opcionais: ['campo_custom']
        }),
        ativo: true
    },
    {
        nome: 'Fisioterapia - Matriz',
        tipo: 'profissional',
        especialidade: 'Fisioterapia',
        unidade: 'Matriz',
        arquivo_path: path.join(__dirname, '../../CONTRATOS/Novo Padrão - Fisio - Mtz.docx'),
        campos_json: JSON.stringify({
            campos: ['nome', 'endereco', 'cpf', 'data_assinatura', 'dia_pagamento'],
            campos_opcionais: []
        }),
        ativo: true
    },
    {
        nome: 'Fisioterapia - São José',
        tipo: 'profissional',
        especialidade: 'Fisioterapia',
        unidade: 'São José',
        arquivo_path: path.join(__dirname, '../../CONTRATOS/Novo Padrão - Fisio - SJ.docx'),
        campos_json: JSON.stringify({
            campos: ['nome', 'endereco', 'cpf', 'data_assinatura', 'dia_pagamento'],
            campos_opcionais: []
        }),
        ativo: true
    },
    {
        nome: 'Neurologia - Matriz',
        tipo: 'profissional',
        especialidade: 'Neurologia',
        unidade: 'Matriz',
        arquivo_path: path.join(__dirname, '../../CONTRATOS/Novo Padrão - Neuro - Mtz.docx'),
        campos_json: JSON.stringify({
            campos: ['nome', 'endereco', 'cpf', 'data_assinatura', 'dia_pagamento'],
            campos_opcionais: []
        }),
        ativo: true
    },
    {
        nome: 'Pélvica - Matriz',
        tipo: 'profissional',
        especialidade: 'Pélvica',
        unidade: 'Matriz',
        arquivo_path: path.join(__dirname, '../../CONTRATOS/Novo Padrão - Pelvica - Mtz.docx'),
        campos_json: JSON.stringify({
            campos: ['nome', 'endereco', 'cpf', 'data_assinatura', 'dia_pagamento'],
            campos_opcionais: []
        }),
        ativo: true
    },
    {
        nome: 'RPG - Matriz (2 Profissionais)',
        tipo: 'profissional',
        especialidade: 'RPG',
        unidade: 'Matriz',
        arquivo_path: path.join(__dirname, '../../CONTRATOS/Novo Padrão - RPG - Mtz - 2P.docx'),
        campos_json: JSON.stringify({
            campos: ['nome', 'endereco', 'cpf', 'data_assinatura', 'dia_pagamento'],
            campos_opcionais: []
        }),
        ativo: true
    },
    {
        nome: 'Estágio',
        tipo: 'estagio',
        especialidade: null,
        unidade: 'Matriz',
        arquivo_path: path.join(__dirname, '../../CONTRATOS/CONTRATO ESTAGIO HELOISA.docx'),
        campos_json: JSON.stringify({
            campos: ['nome', 'endereco', 'cpf', 'periodo_curso', 'universidade', 'curso', 'data_inicio', 'data_fim', 'valor_bolsa', 'horarios'],
            campos_opcionais: ['horarios']
        }),
        ativo: true
    }
];

async function popular() {
    try {
        console.log('📄 Iniciando população de modelos de contratos...\n');

        // 1. Criar tabelas se não existirem
        console.log('🔧 Verificando tabelas...');
        await adicionarTabelasContratos();

        // 2. Limpar dados existentes (opcional)
        const existentes = await db('contratos_modelos').count('* as total').first();
        if (existentes.total > 0) {
            console.log(`\n⚠️  Já existem ${existentes.total} modelos cadastrados.`);
            console.log('Pulando inserção para evitar duplicatas.\n');
            process.exit(0);
        }

        // 3. Validar que os arquivos existem
        console.log('\n📁 Validando arquivos de template...');
        let arquivosValidos = 0;
        let arquivosInvalidos = 0;

        modelos.forEach(modelo => {
            if (fs.existsSync(modelo.arquivo_path)) {
                console.log(`✅ ${modelo.nome}`);
                arquivosValidos++;
            } else {
                console.log(`❌ ${modelo.nome} - Arquivo não encontrado: ${modelo.arquivo_path}`);
                arquivosInvalidos++;
            }
        });

        if (arquivosInvalidos > 0) {
            console.log(`\n⚠️  ${arquivosInvalidos} arquivo(s) não encontrado(s).`);
            console.log('Certifique-se de que a pasta CONTRATOS está no local correto.\n');
        }

        // 4. Inserir modelos
        console.log('\n💾 Inserindo modelos no banco de dados...');
        for (const modelo of modelos) {
            if (fs.existsSync(modelo.arquivo_path)) {
                await db('contratos_modelos').insert(modelo);
                console.log(`✅ ${modelo.nome} inserido`);
            }
        }

        // 5. Confirmar
        const total = await db('contratos_modelos').count('* as total').first();
        console.log(`\n✅ População concluída! Total de modelos: ${total.total}`);
        console.log('\n📊 Resumo por tipo:');

        const porTipo = await db('contratos_modelos')
            .select('tipo')
            .count('* as total')
            .groupBy('tipo');

        porTipo.forEach(item => {
            console.log(`   - ${item.tipo}: ${item.total}`);
        });

        console.log('\n✅ Sistema de contratos pronto para uso!\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Erro ao popular modelos:', error);
        process.exit(1);
    }
}

// Executar
popular();
