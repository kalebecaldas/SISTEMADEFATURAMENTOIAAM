const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../database/init');
const logger = require('./logger');

class DocumentoService {
    constructor() {
        this.baseDir = path.join(__dirname, '../uploads/documentos');
        this.ensureBaseDirectory();
    }

    ensureBaseDirectory() {
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
            logger.info('Documents base directory created', { dir: this.baseDir });
        }
    }

    /**
     * Configurar storage do multer
     */
    getMulterStorage() {
        return multer.diskStorage({
            destination: (req, file, cb) => {
                const prestadorId = req.body.prestador_id;
                const tipo = req.body.tipo || 'documento_geral';

                const dir = path.join(this.baseDir, prestadorId.toString(), tipo);

                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                cb(null, dir);
            },
            filename: (req, file, cb) => {
                const timestamp = Date.now();
                const originalName = file.originalname;
                const ext = path.extname(originalName);
                const nameWithoutExt = path.basename(originalName, ext);
                const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');

                cb(null, `${safeName}_${timestamp}${ext}`);
            }
        });
    }

    /**
     * Configurar filtro de arquivos
     */
    getFileFilter() {
        return (req, file, cb) => {
            const allowedMimes = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'image/jpeg',
                'image/png',
                'image/jpg',
            ];

            if (allowedMimes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Tipo de arquivo não permitido. Permitidos: PDF, DOC, DOCX, JPG, PNG'), false);
            }
        };
    }

    /**
     * Upload de documento
     */
    async uploadDocumento(file, metadata) {
        try {
            logger.info('Uploading document', { fileName: file.filename, prestadorId: metadata.prestador_id });

            const [documentoId] = await db('documentos_prestador').insert({
                prestador_id: metadata.prestador_id,
                tipo: metadata.tipo,
                categoria: metadata.categoria || null,
                nome_arquivo: file.originalname,
                arquivo_path: file.path,
                tamanho_bytes: file.size,
                mime_type: file.mimetype,
                descricao: metadata.descricao || null,
                data_upload: db.fn.now(),
                uploaded_by: metadata.uploaded_by || null,
            });

            logger.info('Document uploaded successfully', { documentoId, fileName: file.filename });

            return {
                id: documentoId,
                nome_arquivo: file.originalname,
                tamanho_bytes: file.size,
                mime_type: file.mimetype,
            };
        } catch (error) {
            logger.error('Error uploading document', error, { fileName: file.filename });
            throw error;
        }
    }

    /**
     * Listar documentos de um prestador
     */
    async listarDocumentos(prestadorId, tipo = null) {
        try {
            let query = db('documentos_prestador as dp')
                .leftJoin('usuarios as u', 'dp.uploaded_by', 'u.id')
                .select(
                    'dp.id',
                    'dp.tipo',
                    'dp.categoria',
                    'dp.nome_arquivo',
                    'dp.arquivo_path',
                    'dp.tamanho_bytes',
                    'dp.mime_type',
                    'dp.descricao',
                    'dp.data_upload',
                    'u.nome as uploaded_by_nome'
                )
                .where('dp.prestador_id', prestadorId);

            if (tipo) {
                query = query.where('dp.tipo', tipo);
            }

            const documentos = await query.orderBy('dp.data_upload', 'desc');

            return documentos;
        } catch (error) {
            logger.error('Error listing documents', error, { prestadorId });
            throw error;
        }
    }

    /**
     * Buscar documento por ID
     */
    async buscarDocumento(documentoId) {
        try {
            const documento = await db('documentos_prestador')
                .where({ id: documentoId })
                .first();

            if (!documento) {
                throw new Error('Documento não encontrado');
            }

            return documento;
        } catch (error) {
            logger.error('Error fetching document', error, { documentoId });
            throw error;
        }
    }

    /**
     * Deletar documento
     */
    async deletarDocumento(documentoId) {
        try {
            const documento = await this.buscarDocumento(documentoId);

            // Deletar arquivo físico
            if (fs.existsSync(documento.arquivo_path)) {
                fs.unlinkSync(documento.arquivo_path);
                logger.info('Physical file deleted', { path: documento.arquivo_path });
            }

            // Deletar registro do banco
            await db('documentos_prestador')
                .where({ id: documentoId })
                .delete();

            logger.info('Document deleted successfully', { documentoId });
            return true;
        } catch (error) {
            logger.error('Error deleting document', error, { documentoId });
            throw error;
        }
    }

    /**
     * Atualizar metadados do documento
     */
    async atualizarDocumento(documentoId, updates) {
        try {
            const allowedUpdates = ['descricao', 'categoria'];
            const updateData = {};

            Object.keys(updates).forEach(key => {
                if (allowedUpdates.includes(key)) {
                    updateData[key] = updates[key];
                }
            });

            updateData.updated_at = db.fn.now();

            await db('documentos_prestador')
                .where({ id: documentoId })
                .update(updateData);

            logger.info('Document metadata updated', { documentoId, updates: updateData });
            return true;
        } catch (error) {
            logger.error('Error updating document', error, { documentoId });
            throw error;
        }
    }

    /**
     * Obter estatísticas de documentos por prestador
     */
    async getEstatisticas(prestadorId) {
        try {
            const stats = await db('documentos_prestador')
                .where({ prestador_id: prestadorId })
                .select('tipo')
                .count('* as total')
                .sum('tamanho_bytes as tamanho_total')
                .groupBy('tipo');

            const totalGeral = await db('documentos_prestador')
                .where({ prestador_id: prestadorId })
                .count('* as total')
                .sum('tamanho_bytes as tamanho_total')
                .first();

            return {
                por_tipo: stats,
                total: totalGeral,
            };
        } catch (error) {
            logger.error('Error getting document statistics', error, { prestadorId });
            throw error;
        }
    }
}

module.exports = new DocumentoService();
