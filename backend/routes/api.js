const express = require('express');
const router = express.Router();
const { authenticateToken: auth } = require('../middleware/auth');
const { db } = require('../database/init');

// Endpoint para dados do dashboard (otimizado para mobile)
router.get('/dashboard/summary', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.tipo;

    if (userType === 'admin') {
      // Dashboard admin - resumo geral
      const prestadoresCount = await db('usuarios').where({ tipo: 'prestador' }).count('* as count').first();
      const dadosCount = await db('dados_mensais').count('* as count').first();
      const notasCount = await db('notas_fiscais').count('* as count').first();

      res.json({
        success: true,
        data: {
          totalPrestadores: parseInt(prestadoresCount.count),
          totalDados: parseInt(dadosCount.count),
          totalNotas: parseInt(notasCount.count),
          ultimaAtualizacao: new Date().toISOString()
        }
      });
    } else {
      // Dashboard prestador - dados pessoais
      const dados = await db('usuarios as u')
        .leftJoin('dados_mensais as dm', 'u.id', 'dm.prestador_id')
        .select(
          'u.nome',
          'u.email',
          'dm.valor_bruto',
          'dm.valor_liquido',
          'dm.faltas',
          'dm.mes',
          'dm.ano'
        )
        .where('u.id', userId)
        .orderBy([
          { column: 'dm.ano', order: 'desc' },
          { column: 'dm.mes', order: 'desc' }
        ])
        .first();

      res.json({
        success: true,
        data: dados || null
      });
    }
  } catch (error) {
    console.error('Erro no dashboard summary:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// Endpoint para histórico (paginado para mobile)
router.get('/historico', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.tipo;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    if (userType === 'admin') {
      // Histórico admin - dados mensais de todos os prestadores
      const dados = await db('dados_mensais as dm')
        .join('usuarios as u', 'dm.prestador_id', 'u.id')
        .select(
          'dm.id',
          'u.nome',
          'dm.valor_bruto',
          'dm.valor_liquido',
          'dm.faltas',
          'dm.mes',
          'dm.ano',
          'dm.created_at'
        )
        .orderBy([
          { column: 'dm.ano', order: 'desc' },
          { column: 'dm.mes', order: 'desc' }
        ])
        .limit(limit)
        .offset(offset);

      const total = await db('dados_mensais').count('* as count').first();

      res.json({
        success: true,
        data: {
          dados,
          pagination: {
            page,
            limit,
            total: parseInt(total.count),
            totalPages: Math.ceil(parseInt(total.count) / limit)
          }
        }
      });
    } else {
      // Histórico prestador - dados pessoais
      const dados = await db('dados_mensais as dm')
        .join('usuarios as u', 'dm.prestador_id', 'u.id')
        .select(
          'dm.id',
          'u.nome',
          'dm.valor_bruto',
          'dm.valor_liquido',
          'dm.faltas',
          'dm.mes',
          'dm.ano',
          'dm.created_at'
        )
        .where('u.id', userId)
        .orderBy([
          { column: 'dm.ano', order: 'desc' },
          { column: 'dm.mes', order: 'desc' }
        ])
        .limit(limit)
        .offset(offset);

      const total = await db('dados_mensais').where({ prestador_id: userId }).count('* as count').first();

      res.json({
        success: true,
        data: {
          dados,
          pagination: {
            page,
            limit,
            total: parseInt(total.count),
            totalPages: Math.ceil(parseInt(total.count) / limit)
          }
        }
      });
    }
  } catch (error) {
    console.error('Erro no histórico:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// Endpoint para busca de prestadores (admin)
router.get('/prestadores/search', auth, async (req, res) => {
  try {
    if (req.user.tipo !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { q, mes, ano } = req.query;

    let query = db('usuarios as u')
      .leftJoin('dados_mensais as dm', 'u.id', 'dm.prestador_id')
      .select(
        'u.id',
        'u.nome',
        'u.email',
        'dm.valor_bruto',
        'dm.valor_liquido',
        'dm.faltas',
        'dm.mes',
        'dm.ano'
      )
      .where('u.tipo', 'prestador');

    if (q) {
      query = query.where((builder) => {
        builder.where('u.nome', 'like', `%${q}%`)
          .orWhere('u.email', 'like', `%${q}%`);
      });
    }

    if (mes) {
      query = query.where('dm.mes', mes);
    }

    if (ano) {
      query = query.where('dm.ano', ano);
    }

    const prestadores = await query.orderBy('u.nome', 'asc');

    res.json({
      success: true,
      data: prestadores
    });
  } catch (error) {
    console.error('Erro na busca de prestadores:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// Endpoint para estatísticas (admin)
router.get('/stats', auth, async (req, res) => {
  try {
    if (req.user.tipo !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { mes, ano } = req.query;

    let query = db('usuarios as u')
      .leftJoin('dados_mensais as dm', 'u.id', 'dm.prestador_id')
      .where('u.tipo', 'prestador');

    if (mes && ano) {
      query = query.where({ 'dm.mes': mes, 'dm.ano': ano });
    }

    // We need separate queries or complex aggregation. 
    // Knex aggregation can be tricky with joins if not careful.
    // Let's do separate queries for simplicity and correctness.

    // Total Prestadores
    let prestadoresQuery = db('usuarios as u')
      .leftJoin('dados_mensais as dm', 'u.id', 'dm.prestador_id')
      .where('u.tipo', 'prestador');

    if (mes && ano) {
      prestadoresQuery = prestadoresQuery.where({ 'dm.mes': mes, 'dm.ano': ano });
    }
    const totalPrestadores = await prestadoresQuery.countDistinct('u.id as count').first();

    // Total Valor and Media Faltas
    let statsQuery = db('dados_mensais as dm');
    if (mes && ano) {
      statsQuery = statsQuery.where({ 'dm.mes': mes, 'dm.ano': ano });
    }
    const stats = await statsQuery.sum('dm.valor_liquido as total').avg('dm.faltas as media').first();

    res.json({
      success: true,
      data: {
        totalPrestadores: parseInt(totalPrestadores.count),
        totalValor: parseFloat(stats.total || 0),
        mediaFaltas: parseFloat(stats.media || 0)
      }
    });
  } catch (error) {
    console.error('Erro nas estatísticas:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// Endpoint para configurações do usuário
router.get('/user/settings', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await db('usuarios')
      .select('id', 'nome', 'email', 'tipo', 'created_at')
      .where('id', userId)
      .first();

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Erro nas configurações do usuário:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

module.exports = router;