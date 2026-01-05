const { db } = require('../database/init');
const path = require('path');

/**
 * Script para popular modelos de contratos
 * Execute apenas uma vez: node backend/scripts/popular_contratos.js
 */

const contratos = [
    {
        nome: 'Contrato Acupuntura Matriz',
        tipo: 'profissional',
        especialidade: 'Acupuntura',
        unidade: 'Matriz',
        arquivo_path: path.join(__dirname, '../../CONTRATOS/Contrato Acupuntura Matriz.doc'),
        meta_mensal: 5000.00, // TODO: Ajustar com valor real do contrato
        ativo: true
    },
    {
        nome: 'Contrato Acupuntura São José',
        tipo: 'profissional',
        especialidade: 'Acupuntura',
        unidade: 'São José',
        arquivo_path: path.join(__dirname, '../../CONTRATOS/Contrato Acupuntura São José.doc'),
        meta_mensal: 5000.00, // TODO: Ajustar com valor real do contrato
        ativo: true
    },
    {
        nome: 'Contrato Fisioterapia Matriz',
        tipo: 'profissional',
        especialidade: 'Fisioterapia',
        unidade: 'Matriz',
        arquivo_path: path.join(__dirname, '../../CONTRATOS/Contrato Fisioterapia Matriz.docx'),
        meta_mensal: 5000.00, // TODO: Ajustar com valor real do contrato
        ativo: true
    },
    {
        nome: 'Contrato Fisioterapia Neurológica Matriz',
        tipo: 'profissional',
        especialidade: 'Fisioterapia Neurológica',
        unidade: 'Matriz',
        arquivo_path: path.join(__dirname, '../../CONTRATOS/Contrato Fisioterapia Neurológica Matriz.docx'),
        meta_mensal: 5000.00, // TODO: Ajustar com valor real do contrato
        ativo: true
    },
    {
        nome: 'Contrato Fisioterapia Pélvica Matriz',
        tipo: 'profissional',
        especialidade: 'Fisioterapia Pélvica',
        unidade: 'Matriz',
        arquivo_path: path.join(__dirname, '../../CONTRATOS/Contrato Fisioterapia Pélvica Matriz.docx'),
        meta_mensal: 5000.00, // TODO: Ajustar com valor real do contrato
        ativo: true
    },
    {
        nome: 'Contrato Fisioterapia São José',
        tipo: 'profissional',
        especialidade: 'Fisioterapia',
        unidade: 'São José',
        arquivo_path: path.join(__dirname, '../../CONTRATOS/Contrato Fisioterapia São José.docx'),
        meta_mensal: 5000.00, // TODO: Ajustar com valor real do contrato
        ativo: true
    },
    {
        nome: 'Contrato RPG Matriz',
        tipo: 'profissional',
        especialidade: 'RPG',
        unidade: 'Matriz',
        arquivo_path: path.join(__dirname, '../../CONTRATOS/Contrato RPG Matriz.docx'),
        meta_mensal: 5000.00, // TODO: Ajustar com valor real do contrato
        ativo: true
    },
    {
        nome: 'Contrato RPG São José',
        tipo: 'profissional',
        especialidade: 'RPG',
        unidade: 'São José',
        arquivo_path: path.join(__dirname, '../../CONTRATOS/Contrato RPG São José.docx'),
        meta_mensal: 5000.00, // TODO: Ajustar com valor real do contrato
        ativo: true
    },
    {
        nome: 'Contrato Estágio',
        tipo: 'estagio',
        especialidade: null,
        unidade: null,
        arquivo_path: path.join(__dirname, '../../CONTRATOS/Contrato Estágio.docx'),
        meta_mensal: null, // Estagiários não têm meta
        ativo: true
    }
];

const popularContratos = async () => {
    try {
        console.log('📋 Populando modelos de contratos...');

        for (const contrato of contratos) {
            // Verificar se já existe
            const existe = await db('contratos_modelos')
                .where({ nome: contrato.nome })
                .first();

            if (!existe) {
                await db('contratos_modelos').insert(contrato);
                console.log(`✅ Contrato criado: ${contrato.nome}`);
            } else {
                // Atualizar meta_mensal se ainda não foi definida
                if (existe.meta_mensal === null && contrato.meta_mensal !== null) {
                    await db('contratos_modelos')
                        .where({ id: existe.id })
                        .update({ meta_mensal: contrato.meta_mensal });
                    console.log(`🔄 Meta atualizada: ${contrato.nome}`);
                } else {
                    console.log(`ℹ️  Contrato já existe: ${contrato.nome}`);
                }
            }
        }

        console.log('✅ Todos os contratos foram processados!');
        console.log('\n⚠️  ATENÇÃO: Ajuste os valores de meta_mensal conforme os contratos reais!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao popular contratos:', error);
        process.exit(1);
    }
};

// Executar se chamado diretamente
if (require.main === module) {
    popularContratos();
}

module.exports = { popularContratos };
