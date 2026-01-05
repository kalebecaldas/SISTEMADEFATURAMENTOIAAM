const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../database/init');
const { authenticateToken, requireAdmin, requirePrestador, checkUserActive } = require('../middleware/auth');

const router = express.Router();

// Configuração do multer para upload de notas fiscais
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/notas_fiscais');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'nota-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF e imagens são permitidos'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Listar todos os prestadores (Admin)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Verificar se é admin ou master
    if (req.user.tipo !== 'admin' && req.user.tipo !== 'master') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const prestadores = await db('usuarios')
      .select(
        'id',
        'nome',
        'email',
        'tipo',
        'ativo',
        'status',
        'tipo_colaborador',
        'especialidade',
        'unidades',
        'telefone',
        'valor_fixo',
        'meta_mensal',
        'contrato_id',
        'cadastro_confirmado',
        'created_at'
      )
      .where('tipo', '!=', 'admin')
      .where('tipo', '!=', 'master')
      .orderBy('nome', 'asc');

    // Parse JSON fields with error handling
    const prestadoresFormatados = prestadores.map(p => {
      let unidades = [];
      try {
        if (p.unidades) {
          unidades = typeof p.unidades === 'string' ? JSON.parse(p.unidades) : p.unidades;
        }
      } catch (e) {
        console.warn(`Erro ao parsear unidades para prestador ${p.id}: `, e.message);
        unidades = [];
      }

      return {
        ...p,
        unidades
      };
    });

    res.json(prestadoresFormatados);
  } catch (error) {
    console.error('Erro ao listar prestadores:', error);
    res.status(500).json({ error: 'Erro ao listar prestadores: ' + error.message });
  }
});

// Atualizar prestador (Admin)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.tipo !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const {
      nome,
      email,
      telefone,
      especialidade,
      unidades, // Array: ["Matriz", "Anexo", "São José"]
      contrato_id,
      meta_mensal,
      valor_fixo,
      status,
      tipo_colaborador
    } = req.body;

    const updateData = {};

    if (nome) updateData.nome = nome;
    if (email) updateData.email = email;
    if (telefone !== undefined) updateData.telefone = telefone;
    if (especialidade !== undefined) updateData.especialidade = especialidade;
    if (unidades !== undefined) updateData.unidades = JSON.stringify(unidades);
    if (contrato_id !== undefined) updateData.contrato_id = contrato_id;
    if (meta_mensal !== undefined) updateData.meta_mensal = parseFloat(meta_mensal);
    if (valor_fixo !== undefined) updateData.valor_fixo = valor_fixo;
    if (status !== undefined) updateData.status = status;
    if (tipo_colaborador !== undefined) updateData.tipo_colaborador = tipo_colaborador;

    const updated = await db('usuarios')
      .where({ id })
      .update(updateData);

    if (!updated) {
      return res.status(404).json({ error: 'Prestador não encontrado' });
    }

    res.json({ message: 'Prestador atualizado com sucesso', prestador: updated });
  } catch (error) {
    console.error('Erro ao atualizar prestador:', error);
    res.status(500).json({ error: 'Erro ao atualizar prestador' });
  }
});

// Deletar prestador (Admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o prestador existe
    const prestador = await db('usuarios').where({ id, tipo: 'prestador' }).first();

    if (!prestador) {
      return res.status(404).json({ error: 'Prestador não encontrado' });
    }

    // Deletar dados relacionados (cascade)
    await db('dados_mensais').where({ prestador_id: id }).del();
    await db('documentos_prestador').where({ prestador_id: id }).del();
    await db('solicitacoes_documentos').where({ prestador_id: id }).del();
    await db('contratos_gerados').where({ prestador_id: id }).del();

    // Deletar o prestador
    await db('usuarios').where({ id }).del();

    res.json({ message: 'Prestador excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar prestador:', error);
    res.status(500).json({ error: 'Erro ao deletar prestador' });
  }
});

// Dashboard do prestador (último mês com dados)
router.get('/dashboard', authenticateToken, requirePrestador, checkUserActive, async (req, res) => {
  try {
    const { mes, ano } = req.query;
    let targetMes = mes;
    let targetAno = ano;

    // Se não especificado, buscar o último mês com dados
    if (!mes || !ano) {
      const ultimoMes = await db('dados_mensais')
        .select('mes', 'ano')
        .where({ prestador_id: req.user.id })
        .orderBy([
          { column: 'ano', order: 'desc' },
          { column: 'mes', order: 'desc' }
        ])
        .first();

      if (!ultimoMes) {
        return res.json({
          message: 'Nenhum dado encontrado',
          mes: null,
          ano: null,
          dados: null
        });
      }
      targetMes = ultimoMes.mes;
      targetAno = ultimoMes.ano;
    }

    // Buscar dados para o mês
    const dados = await db('dados_mensais as dm')
      .join('usuarios as u', 'dm.prestador_id', 'u.id')
      .select(
        'dm.valor_liquido',
        'dm.faltas',
        'dm.meta_batida',
        'dm.valor_bruto',
        'dm.especialidade',
        'dm.unidade',
        'u.nome',
        'u.email'
      )
      .where({
        'dm.prestador_id': req.user.id,
        'dm.mes': parseInt(targetMes),
        'dm.ano': parseInt(targetAno)
      })
      .first();

    if (!dados) {
      return res.json({
        message: 'Nenhum dado encontrado para o período',
        mes: targetMes,
        ano: targetAno,
        dados: null
      });
    }

    // Calcular estatísticas
    const meta = 5000; // Meta padrão
    const percentualMeta = (dados.valor_liquido / meta) * 100;

    res.json({
      mes: targetMes,
      ano: targetAno,
      dados: {
        ...dados,
        meta,
        percentualMeta: Math.round(percentualMeta * 100) / 100,
        statusMeta: dados.meta_batida ? 'Bateu' : 'Não bateu'
      }
    });

  } catch (error) {
    console.error('Erro no dashboard:', error);
    res.status(500).json({ error: 'Erro ao buscar dados' });
  }
});

// Buscar vínculos do prestador (contratos CLT e Prestador)
router.get('/contratos', authenticateToken, requirePrestador, checkUserActive, async (req, res) => {
  try {
    // Buscar todos os vínculos ativos do prestador
    const vinculos = await db('prestador_vinculos')
      .where({ prestador_id: req.user.id, ativo: true })
      .select('*')
      .orderBy('tipo_contrato', 'asc');

    // Separar por tipo
    const vinculosPrestador = vinculos.filter(v => v.tipo_contrato === 'prestador');
    const vinculosCLT = vinculos.filter(v => v.tipo_contrato === 'clt');

    res.json({
      vinculos_prestador: vinculosPrestador,
      vinculos_clt: vinculosCLT,
      total: vinculos.length
    });
  } catch (error) {
    console.error('Erro ao buscar contratos:', error);
    res.status(500).json({ error: 'Erro ao buscar contratos' });
  }
});


// Histórico de dados por mês
router.get('/historico/:mes/:ano', authenticateToken, requirePrestador, checkUserActive, async (req, res) => {
  try {
    const { mes, ano } = req.params;

    // Buscar TODOS os dados mensais do prestador para o período
    const dadosMensais = await db('dados_mensais as dm')
      .leftJoin('prestador_vinculos as pv', 'dm.vinculo_id', 'pv.id')
      .select(
        'dm.valor_liquido',
        'dm.faltas',
        'dm.meta_batida',
        'dm.valor_bruto',
        'dm.especialidade',
        'dm.unidade',
        'dm.tipo_colaborador',
        'dm.dia_inicio',
        'dm.dia_fim',
        'dm.created_at',
        'pv.turno',
        'pv.tipo_contrato'
      )
      .where({
        'dm.prestador_id': req.user.id,
        'dm.mes': parseInt(mes),
        'dm.ano': parseInt(ano)
      });

    if (!dadosMensais || dadosMensais.length === 0) {
      return res.json({
        message: 'Nenhum dado encontrado para o período',
        mes: parseInt(mes),
        ano: parseInt(ano),
        dados: [],
        consolidado: null
      });
    }

    // Separar por tipo
    const dadosPrestador = dadosMensais.filter(d => d.tipo_colaborador === 'prestador' || d.tipo_contrato === 'prestador');
    const dadosCLT = dadosMensais.filter(d => d.tipo_colaborador === 'clt' || d.tipo_contrato === 'clt');

    // Calcular consolidado
    const valorTotalConsolidado = dadosMensais.reduce((sum, d) => sum + (d.valor_liquido || 0), 0);
    const faltasTotais = dadosMensais.reduce((sum, d) => sum + (d.faltas || 0), 0);

    res.json({
      mes: parseInt(mes),
      ano: parseInt(ano),
      dados: dadosMensais,
      prestador: dadosPrestador.length > 0 ? dadosPrestador[0] : null,
      clt: dadosCLT.length > 0 ? dadosCLT[0] : null,
      consolidado: {
        valor_total: valorTotalConsolidado,
        faltas_total: faltasTotais,
        registros: dadosMensais.length
      }
    });
  } catch (error) {
    console.error('Erro no histórico:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

// Listar todos os meses disponíveis
router.get('/meses-disponiveis', authenticateToken, requirePrestador, checkUserActive, async (req, res) => {
  try {
    const meses = await db('dados_mensais')
      .distinct('mes', 'ano')
      .where({ prestador_id: req.user.id })
      .orderBy([
        { column: 'ano', order: 'desc' },
        { column: 'mes', order: 'desc' }
      ]);

    res.json({ meses });
  } catch (error) {
    console.error('Erro ao buscar meses:', error);
    res.status(500).json({ error: 'Erro ao buscar meses' });
  }
});

// Upload de nota fiscal
router.post('/nota-fiscal', authenticateToken, requirePrestador, checkUserActive, upload.single('nota'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const { mes, ano, observacoes } = req.body;
    if (!mes || !ano) {
      return res.status(400).json({ error: 'Mês e ano são obrigatórios' });
    }

    // Verificar se já existe nota para este mês
    const notaExistente = await db('notas_fiscais')
      .select('id')
      .where({
        prestador_id: req.user.id,
        mes: parseInt(mes),
        ano: parseInt(ano)
      })
      .first();

    if (notaExistente) {
      // Atualizar nota existente
      await db('notas_fiscais')
        .where({ id: notaExistente.id })
        .update({
          arquivo_path: req.file.filename,
          status: 'enviado',
          data_envio: db.fn.now(),
          observacoes: observacoes || ''
        });

      res.json({ message: 'Nota fiscal atualizada com sucesso' });
    } else {
      // Inserir nova nota
      await db('notas_fiscais').insert({
        prestador_id: req.user.id,
        mes: parseInt(mes),
        ano: parseInt(ano),
        arquivo_path: req.file.filename,
        status: 'enviado',
        data_envio: db.fn.now(),
        observacoes: observacoes || ''
      });

      res.json({ message: 'Nota fiscal enviada com sucesso' });
    }

  } catch (error) {
    console.error('Erro ao processar nota fiscal:', error);
    res.status(500).json({ error: 'Erro ao processar nota fiscal' });
  }
});

// Listar notas fiscais do prestador
router.get('/notas-fiscais', authenticateToken, requirePrestador, checkUserActive, async (req, res) => {
  try {
    const notas = await db('notas_fiscais')
      .select('id', 'mes', 'ano', 'status', 'data_envio', 'observacoes', 'created_at')
      .where({ prestador_id: req.user.id })
      .orderBy([
        { column: 'ano', order: 'desc' },
        { column: 'mes', order: 'desc' }
      ]);

    res.json({ notas });
  } catch (error) {
    console.error('Erro ao buscar notas fiscais:', error);
    res.status(500).json({ error: 'Erro ao buscar notas fiscais' });
  }
});

// Download de nota fiscal
router.get('/nota-fiscal/:id/download', authenticateToken, requirePrestador, checkUserActive, async (req, res) => {
  try {
    const { id } = req.params;

    const nota = await db('notas_fiscais')
      .select('arquivo_path')
      .where({
        id: id,
        prestador_id: req.user.id
      })
      .first();

    if (!nota) {
      return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    }

    const filePath = path.join(__dirname, '../uploads/notas_fiscais', nota.arquivo_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    res.download(filePath);
  } catch (error) {
    console.error('Erro ao baixar nota fiscal:', error);
    res.status(500).json({ error: 'Erro ao buscar nota fiscal' });
  }
});

// Perfil do prestador
router.get('/perfil', authenticateToken, requirePrestador, checkUserActive, async (req, res) => {
  try {
    const usuario = await db('usuarios')
      .select('id', 'email', 'nome', 'tipo', 'created_at')
      .where({ id: req.user.id })
      .first();

    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ usuario });
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({ error: 'Erro ao buscar perfil' });
  }
});

module.exports = router;