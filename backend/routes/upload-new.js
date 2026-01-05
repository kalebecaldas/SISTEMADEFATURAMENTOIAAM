const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { normalizarUnidade } = require('../utils/unidades');
const { normalizarEspecialidade } = require('../utils/especialidades');

const router = express.Router();

// Configuração do multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'planilha-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.xlsx' && ext !== '.xls') {
            return cb(new Error('Apenas arquivos Excel são permitidos'));
        }
        cb(null, true);
    }
});

/**
 * POST /api/upload/processar
 * Processa a planilha e retorna lista de prestadores novos vs existentes
 * Não salva nada no banco ainda
 */
router.post('/processar', authenticateToken, requireAdmin, upload.single('planilha'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }

        const { mes, ano } = req.body;
        if (!mes || !ano) {
            return res.status(400).json({ error: 'Mês e ano são obrigatórios' });
        }

        console.log(`\n📊 PROCESSANDO PLANILHA: ${mes}/${ano}`);
        console.log(`📁 Arquivo: ${req.file.filename}`);

        const workbook = XLSX.readFile(req.file.path);
        const mesNome = ['', 'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
            'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'][parseInt(mes)];

        const sheet = workbook.Sheets[mesNome];
        if (!sheet) {
            return res.status(400).json({ error: `Aba "${mesNome}" não encontrada na planilha` });
        }

        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const prestadoresMap = new Map(); // email -> prestador

        // Processar linhas
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const funcionario = row[0];
            const email = row[11];

            if (!funcionario || !email || email === 'NP' || !email.includes('@')) continue;

            const emailNormalizado = email.trim().toLowerCase();
            const nomeLimpo = limparNomeTurno(funcionario);
            const turno = detectarTurno(row);
            const especialidadeAbrev = row[2];
            const unidade = normalizarUnidade(row[3]);
            const valorClinica = parseFloat(row[1]) || 0;
            const valorLiquido = parseFloat(row[19]) || 0;
            const metaMensal = row[6];

            let metaMensalValue = null;
            if (metaMensal && metaMensal !== 'N/P' && metaMensal !== 'NP' && !isNaN(parseFloat(metaMensal))) {
                metaMensalValue = parseFloat(metaMensal);
            }

            const especialidadeNormalizada = normalizarEspecialidade(especialidadeAbrev);

            // Agrupar por email
            if (!prestadoresMap.has(emailNormalizado)) {
                prestadoresMap.set(emailNormalizado, {
                    email: emailNormalizado,
                    nome: nomeLimpo,
                    vinculos: []
                });
            }

            const prestador = prestadoresMap.get(emailNormalizado);
            prestador.vinculos.push({
                turno,
                especialidade: especialidadeNormalizada,
                unidade,
                meta_mensal: metaMensalValue,
                valor_liquido: valorLiquido,
                valor_clinica: valorClinica
            });
        }

        // Verificar quais são novos vs existentes
        const novos = [];
        const existentes = [];

        for (const [email, prestador] of prestadoresMap) {
            const usuarioExistente = await db('usuarios')
                .where({ email, tipo: 'prestador' })
                .first();

            if (usuarioExistente) {
                // Buscar vínculos existentes
                const vinculosExistentes = await db('prestador_vinculos')
                    .where('prestador_id', usuarioExistente.id)
                    .select('turno', 'especialidade', 'unidade');

                existentes.push({
                    ...prestador,
                    usuario_id: usuarioExistente.id,
                    vinculos_existentes: vinculosExistentes,
                    vinculos_novos: prestador.vinculos.filter(v =>
                        !vinculosExistentes.some(ve =>
                            ve.turno === v.turno &&
                            ve.especialidade === v.especialidade &&
                            ve.unidade === v.unidade
                        )
                    )
                });
            } else {
                novos.push(prestador);
            }
        }

        // Salvar informações temporárias para o próximo passo
        const tempData = {
            mes: parseInt(mes),
            ano: parseInt(ano),
            filename: req.file.filename,
            filepath: req.file.path,
            prestadores: Array.from(prestadoresMap.values())
        };

        // Armazenar em arquivo temporário
        const tempFile = path.join(__dirname, '../../uploads', `temp-${Date.now()}.json`);
        fs.writeFileSync(tempFile, JSON.stringify(tempData));

        res.json({
            novos,
            existentes,
            tempFile: path.basename(tempFile),
            resumo: {
                total_prestadores: prestadoresMap.size,
                novos: novos.length,
                existentes: existentes.length,
                total_vinculos: Array.from(prestadoresMap.values())
                    .reduce((sum, p) => sum + p.vinculos.length, 0)
            }
        });

    } catch (error) {
        console.error('❌ Erro ao processar planilha:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
