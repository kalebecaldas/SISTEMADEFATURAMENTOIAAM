const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');
const { db } = require('../database/init');
const logger = require('./logger');

class ContratoService {
    constructor() {
        this.templatesDir = path.join(__dirname, '../uploads/contratos/templates');
        this.geradosDir = path.join(__dirname, '../uploads/contratos/gerados');

        // Criar diretórios se não existirem
        this.ensureDirectories();
    }

    ensureDirectories() {
        [this.templatesDir, this.geradosDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                logger.info('Directory created', { dir });
            }
        });
    }

    /**
     * Gerar contrato a partir de um modelo
     */
    async gerarContrato(modeloId, prestadorId, dados) {
        try {
            logger.info('Generating contract', { modeloId, prestadorId });

            // 1. Buscar modelo
            const modelo = await db('contratos_modelos')
                .where({ id: modeloId, ativo: 1 })
                .first();

            if (!modelo) {
                throw new Error('Modelo de contrato não encontrado ou inativo');
            }

            // 2. Buscar prestador
            const prestador = await db('usuarios')
                .where({ id: prestadorId, tipo: 'prestador' })
                .first();

            if (!prestador) {
                throw new Error('Prestador não encontrado');
            }

            // 3. Carregar template
            const templatePath = modelo.arquivo_path;
            if (!fs.existsSync(templatePath)) {
                throw new Error(`Template não encontrado: ${templatePath}`);
            }

            const content = fs.readFileSync(templatePath, 'binary');
            const zip = new PizZip(content);
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
            });

            // 4. Preparar dados para substituição
            const dadosCompletos = {
                ...dados,
                nome: dados.nome || prestador.nome,
                email: dados.email || prestador.email,
                cpf: dados.cpf || prestador.cpf || '',
            };

            // 5. Substituir os marcadores (INSERIR) pelos valores
            // O docxtemplater usa {campo}, mas vamos adaptar para (INSERIR)
            // Primeiro, vamos processar o documento manualmente
            const dadosFormatados = this.formatarDados(dadosCompletos);
            doc.setData(dadosFormatados);

            try {
                doc.render();
            } catch (error) {
                logger.error('Error rendering document', error);
                throw new Error(`Erro ao processar template: ${error.message}`);
            }

            // 6. Gerar buffer do novo documento
            const buf = doc.getZip().generate({
                type: 'nodebuffer',
                compression: 'DEFLATE',
            });

            // 7. Salvar arquivo gerado
            const fileName = this.gerarNomeArquivo(prestador, modelo, dados.data_assinatura);
            const prestadorDir = path.join(this.geradosDir, prestadorId.toString());

            if (!fs.existsSync(prestadorDir)) {
                fs.mkdirSync(prestadorDir, { recursive: true });
            }

            const filePath = path.join(prestadorDir, fileName);
            fs.writeFileSync(filePath, buf);

            // 8. Registrar no banco de dados
            const [contratoId] = await db('contratos_gerados').insert({
                prestador_id: prestadorId,
                modelo_id: modeloId,
                arquivo_path: filePath,
                dados_json: JSON.stringify(dadosCompletos),
                data_geracao: db.fn.now(),
                data_assinatura: dados.data_assinatura || null,
                status: 'gerado',
            });

            // 9. Também registrar em documentos_prestador
            await db('documentos_prestador').insert({
                prestador_id: prestadorId,
                tipo: 'contrato',
                categoria: modelo.especialidade || 'Padrão',
                nome_arquivo: fileName,
                arquivo_path: filePath,
                tamanho_bytes: buf.length,
                mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                descricao: `Contrato ${modelo.nome} gerado automaticamente`,
                data_upload: db.fn.now(),
                uploaded_by: null, // Sistema
            });

            logger.info('Contract generated successfully', {
                contratoId,
                prestadorId,
                fileName,
            });

            return {
                id: contratoId,
                arquivo_path: filePath,
                nome_arquivo: fileName,
            };
        } catch (error) {
            logger.error('Error generating contract', error, { modeloId, prestadorId });
            throw error;
        }
    }

    /**
     * Formatar dados para substituição no documento
     */
    formatarDados(dados) {
        // Implementar lógica de formatação específica
        const formatado = {};

        // Campos padrão
        formatado.NOME = dados.nome || '';
        formatado.ENDERECO = dados.endereco || '';
        formatado.CPF = dados.cpf || '';
        formatado.DATA = dados.data_assinatura ? this.formatarData(dados.data_assinatura) : '';
        formatado.DIA_PAGAMENTO = dados.dia_pagamento || '';
        formatado.CAMPO_CUSTOM = dados.campo_custom || '';
        formatado.PRESTADOR = dados.nome || '';

        // Campos específicos de estágio
        if (dados.tipo === 'estagio') {
            formatado.PERIODO_CURSO = dados.periodo_curso || '';
            formatado.UNIVERSIDADE = dados.universidade || '';
            formatado.CURSO = dados.curso || '';
            formatado.DATA_INICIO = dados.data_inicio ? this.formatarData(dados.data_inicio) : '';
            formatado.DATA_FIM = dados.data_fim ? this.formatarData(dados.data_fim) : '';
            formatado.VALOR_BOLSA = dados.valor_bolsa || '';
            formatado.HORARIOS = dados.horarios || '';
        }

        return formatado;
    }

    /**
     * Formatar data para exibição
     */
    formatarData(data) {
        if (!data) return '';
        const d = new Date(data);
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const ano = d.getFullYear();
        return `${dia}/${mes}/${ano}`;
    }

    /**
     * Gerar nome de arquivo para o contrato
     */
    gerarNomeArquivo(prestador, modelo, dataAssinatura) {
        const nomeLimpo = prestador.nome.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^a-z0-9]/g, '_'); // Remove caracteres especiais

        const especialidade = modelo.especialidade?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'padrao';
        const data = dataAssinatura ? dataAssinatura.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');

        return `contrato_${especialidade}_${nomeLimpo}_${data}.docx`;
    }

    /**
     * Listar contratos de um prestador
     */
    async listarContratosPrestador(prestadorId) {
        try {
            const contratos = await db('contratos_gerados as cg')
                .join('contratos_modelos as cm', 'cg.modelo_id', 'cm.id')
                .join('usuarios as u', 'cg.prestador_id', 'u.id')
                .select(
                    'cg.id',
                    'cg.arquivo_path',
                    'cg.data_geracao',
                    'cg.data_assinatura',
                    'cg.status',
                    'cg.observacoes',
                    'cm.nome as modelo_nome',
                    'cm.especialidade',
                    'u.nome as prestador_nome'
                )
                .where('cg.prestador_id', prestadorId)
                .orderBy('cg.data_geracao', 'desc');

            return contratos;
        } catch (error) {
            logger.error('Error listing contracts', error, { prestadorId });
            throw error;
        }
    }

    /**
     * Atualizar status do contrato
     */
    async atualizarStatus(contratoId, status, dataAssinatura = null) {
        try {
            const updateData = { status, updated_at: db.fn.now() };

            if (status === 'assinado' && dataAssinatura) {
                updateData.data_assinatura = dataAssinatura;
            }

            await db('contratos_gerados')
                .where({ id: contratoId })
                .update(updateData);

            logger.info('Contract status updated', { contratoId, status });
            return true;
        } catch (error) {
            logger.error('Error updating contract status', error, { contratoId });
            throw error;
        }
    }
}

module.exports = new ContratoService();
