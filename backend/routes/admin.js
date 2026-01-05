const express = require('express');
const { db } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Dashboard administrativo
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { mes, ano } = req.query;
    let targetMes = mes;
    let targetAno = ano;

    // Se não especificado, buscar o último mês com dados
    if (!mes || !ano) {
      const ultimoMes = await db('dados_mensais')
        .select('mes', 'ano')
        .orderBy([
          { column: 'ano', order: 'desc' },
          { column: 'mes', order: 'desc' }
        ])
        .first();

      if (!ultimoMes) {
        return res.json({
          mes: null,
          ano: null,
          estatisticas: {
            total_prestadores: 0,
            valor_total: 0,
            valor_medio: 0,
            total_faltas: 0,
            metas_batidas: 0,
            total_notas: 0,
            notas_enviadas: 0,
            notas_pendentes: 0
          },
          mensagem: 'Nenhum dado encontrado'
        });
      }
      targetMes = ultimoMes.mes;
      targetAno = ultimoMes.ano;
    }

    // Estatísticas gerais
    const stats = await db('dados_mensais')
      .where({ mes: parseInt(targetMes), ano: parseInt(targetAno) })
      .select(
        db.raw('COUNT(DISTINCT prestador_id) as total_prestadores'),
        db.raw('SUM(valor_liquido) as valor_total'),
        db.raw('AVG(valor_liquido) as valor_medio'),
        db.raw('SUM(faltas) as total_faltas'),
        db.raw('SUM(CASE WHEN meta_batida = 1 THEN 1 ELSE 0 END) as metas_batidas')
      )
      .first();

    // Status das notas fiscais
    const notasStats = await db('notas_fiscais as nf')
      .join('dados_mensais as dm', 'nf.prestador_id', 'dm.prestador_id')
      .where({ 'dm.mes': parseInt(targetMes), 'dm.ano': parseInt(targetAno) })
      .select(
        db.raw('COUNT(*) as total_notas'),
        db.raw("SUM(CASE WHEN status = 'enviado' THEN 1 ELSE 0 END) as notas_enviadas"),
        db.raw("SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) as notas_pendentes")
      )
      .first();

    res.json({
      mes: targetMes,
      ano: targetAno,
      estatisticas: {
        total_prestadores: parseInt(stats.total_prestadores || 0),
        valor_total: parseFloat(stats.valor_total || 0),
        valor_medio: parseFloat(stats.valor_medio || 0),
        total_faltas: parseInt(stats.total_faltas || 0),
        metas_batidas: parseInt(stats.metas_batidas || 0),
        total_notas: parseInt(notasStats.total_notas || 0),
        notas_enviadas: parseInt(notasStats.notas_enviadas || 0),
        notas_pendentes: parseInt(notasStats.notas_pendentes || 0)
      }
    });

  } catch (error) {
    console.error('Erro no dashboard admin:', error);
    res.status(500).json({ error: 'Erro ao buscar dados do dashboard' });
  }
});

// Listar todos os prestadores
router.get('/prestadores', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = db('usuarios as u')
      .leftJoin('dados_mensais as dm', 'u.id', 'dm.prestador_id')
      .where('u.tipo', 'prestador')
      .groupBy('u.id');

    if (search) {
      query = query.where((builder) => {
        builder.where('u.nome', 'like', `%${search}%`)
          .orWhere('u.email', 'like', `%${search}%`);
      });
    }

    // Clone query for count
    const countQuery = db('usuarios as u')
      .where('u.tipo', 'prestador');

    if (search) {
      countQuery.where((builder) => {
        builder.where('u.nome', 'like', `%${search}%`)
          .orWhere('u.email', 'like', `%${search}%`);
      });
    }

    const countResult = await countQuery.count('* as total').first();

    const prestadores = await query
      .select(
        'u.id',
        'u.nome',
        'u.email',
        'u.ativo',
        'u.created_at',
        db.raw('COUNT(dm.id) as total_meses'),
        db.raw('MAX(dm.created_at) as ultima_atualizacao')
      )
      .orderBy('u.nome')
      .limit(limit)
      .offset(offset);

    res.json({
      prestadores,
      paginacao: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.total),
        pages: Math.ceil(parseInt(countResult.total) / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar prestadores:', error);
    res.status(500).json({ error: 'Erro ao listar prestadores' });
  }
});

// Detalhes de um prestador específico
router.get('/prestadores/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const prestador = await db('usuarios')
      .select('id', 'nome', 'email', 'ativo', 'created_at')
      .where({ id, tipo: 'prestador' })
      .first();

    if (!prestador) {
      return res.status(404).json({ error: 'Prestador não encontrado' });
    }

    // Buscar histórico de dados
    const historico = await db('dados_mensais')
      .select(
        'mes', 'ano', 'valor_liquido', 'faltas', 'meta_batida',
        'valor_bruto', 'especialidade', 'unidade', 'created_at'
      )
      .where({ prestador_id: id })
      .orderBy([
        { column: 'ano', order: 'desc' },
        { column: 'mes', order: 'desc' }
      ]);

    // Buscar notas fiscais
    const notas = await db('notas_fiscais')
      .select(
        'id', 'mes', 'ano', 'status', 'data_envio', 'observacoes', 'created_at'
      )
      .where({ prestador_id: id })
      .orderBy([
        { column: 'ano', order: 'desc' },
        { column: 'mes', order: 'desc' }
      ]);

    res.json({
      prestador,
      historico,
      notas
    });
  } catch (error) {
    console.error('Erro ao buscar detalhes do prestador:', error);
    res.status(500).json({ error: 'Erro ao buscar detalhes do prestador' });
  }
});

// Ativar/desativar prestador
router.put('/prestadores/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { ativo } = req.body;

    const updated = await db('usuarios')
      .where({ id, tipo: 'prestador' })
      .update({
        ativo: ativo ? 1 : 0,
        updated_at: db.fn.now()
      });

    if (!updated) {
      return res.status(404).json({ error: 'Prestador não encontrado' });
    }

    res.json({ message: `Prestador ${ativo ? 'ativado' : 'desativado'} com sucesso` });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

// Relatório de notas fiscais
router.get('/relatorio-notas/:mes/:ano', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { mes, ano } = req.params;

    const relatorio = await db('usuarios as u')
      .leftJoin('dados_mensais as dm', function () {
        this.on('u.id', '=', 'dm.prestador_id')
          .andOn('dm.mes', '=', db.raw('?', [parseInt(mes)]))
          .andOn('dm.ano', '=', db.raw('?', [parseInt(ano)]));
      })
      .leftJoin('notas_fiscais as nf', function () {
        this.on('u.id', '=', 'nf.prestador_id')
          .andOn('nf.mes', '=', db.raw('?', [parseInt(mes)]))
          .andOn('nf.ano', '=', db.raw('?', [parseInt(ano)]));
      })
      .select(
        'u.nome',
        'u.email',
        'dm.valor_liquido',
        'nf.status',
        'nf.data_envio',
        'nf.observacoes'
      )
      .where({
        'u.tipo': 'prestador',
        'u.ativo': 1
      })
      .orderBy('u.nome');

    res.json(relatorio);
  } catch (error) {
    console.error('Erro ao gerar relatório de notas:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

// Relatório de prestadores
router.get('/relatorio-prestadores/:mes/:ano', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { mes, ano } = req.params;

    const relatorio = await db('usuarios as u')
      .leftJoin('dados_mensais as dm', function () {
        this.on('u.id', '=', 'dm.prestador_id')
          .andOn('dm.mes', '=', db.raw('?', [parseInt(mes)]))
          .andOn('dm.ano', '=', db.raw('?', [parseInt(ano)]));
      })
      .select(
        'u.nome',
        'u.email',
        'dm.valor_liquido',
        'dm.faltas',
        'dm.meta_batida',
        'dm.especialidade',
        'dm.unidade'
      )
      .where({
        'u.tipo': 'prestador',
        'u.ativo': 1
      })
      .orderBy('u.nome');

    res.json(relatorio);
  } catch (error) {
    console.error('Erro ao gerar relatório de prestadores:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

// Relatório de performance
router.get('/relatorio-performance/:mes/:ano', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { mes, ano } = req.params;

    const relatorio = await db('usuarios as u')
      .leftJoin('dados_mensais as dm', function () {
        this.on('u.id', '=', 'dm.prestador_id')
          .andOn('dm.mes', '=', db.raw('?', [parseInt(mes)]))
          .andOn('dm.ano', '=', db.raw('?', [parseInt(ano)]));
      })
      .select(
        'u.nome',
        'dm.valor_liquido',
        db.raw('5000 as meta'),
        db.raw('ROUND((dm.valor_liquido / 5000) * 100, 2) as percentual_meta'),
        db.raw(`CASE 
          WHEN dm.valor_liquido >= 5000 THEN 'Meta Batida'
          WHEN dm.valor_liquido >= 4000 THEN 'Próximo da Meta'
          ELSE 'Abaixo da Meta'
        END as status`)
      )
      .where({
        'u.tipo': 'prestador',
        'u.ativo': 1
      })
      .orderBy('dm.valor_liquido', 'desc');

    res.json(relatorio);
  } catch (error) {
    console.error('Erro ao gerar relatório de performance:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

// Rota para buscar meses disponíveis
router.get('/meses-disponiveis', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const meses = await db('dados_mensais')
      .distinct('mes', 'ano')
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

// Relatório geral por período
router.get('/relatorio-geral', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { mes_inicio, ano_inicio, mes_fim, ano_fim } = req.query;

    let query = db('usuarios as u')
      .join('dados_mensais as dm', 'u.id', 'dm.prestador_id');

    if (mes_inicio && ano_inicio && mes_fim && ano_fim) {
      query = query.where(function () {
        this.where(function () {
          this.where('dm.ano', '>', parseInt(ano_inicio))
            .orWhere(function () {
              this.where('dm.ano', '=', parseInt(ano_inicio))
                .andWhere('dm.mes', '>=', parseInt(mes_inicio));
            });
        }).andWhere(function () {
          this.where('dm.ano', '<', parseInt(ano_fim))
            .orWhere(function () {
              this.where('dm.ano', '=', parseInt(ano_fim))
                .andWhere('dm.mes', '<=', parseInt(mes_fim));
            });
        });
      });
    }

    const dados = await query
      .select(
        'u.nome',
        'u.email',
        'dm.mes',
        'dm.ano',
        'dm.valor_liquido',
        'dm.faltas',
        'dm.meta_batida',
        'dm.especialidade',
        'dm.unidade'
      )
      .orderBy([
        { column: 'u.nome', order: 'asc' },
        { column: 'dm.ano', order: 'desc' },
        { column: 'dm.mes', order: 'desc' }
      ]);

    // Agrupar por prestador
    const prestadores = {};
    dados.forEach(d => {
      if (!prestadores[d.email]) {
        prestadores[d.email] = {
          nome: d.nome,
          email: d.email,
          meses: [],
          total_valor: 0,
          total_faltas: 0,
          metas_batidas: 0
        };
      }

      prestadores[d.email].meses.push({
        mes: d.mes,
        ano: d.ano,
        valor_liquido: d.valor_liquido,
        faltas: d.faltas,
        meta_batida: d.meta_batida,
        especialidade: d.especialidade,
        unidade: d.unidade
      });

      prestadores[d.email].total_valor += d.valor_liquido;
      prestadores[d.email].total_faltas += d.faltas;
      if (d.meta_batida) prestadores[d.email].metas_batidas++;
    });

    res.json({
      periodo: { mes_inicio, ano_inicio, mes_fim, ano_fim },
      prestadores: Object.values(prestadores)
    });
  } catch (error) {
    console.error('Erro ao gerar relatório geral:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

// Configurações do sistema
router.get('/configuracoes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const configs = await db('configuracoes').select('chave', 'valor', 'descricao').orderBy('chave');

    const configuracoes = {};
    configs.forEach(config => {
      configuracoes[config.chave] = {
        valor: config.valor,
        descricao: config.descricao
      };
    });

    res.json({ configuracoes });
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

// Atualizar configurações
router.put('/configuracoes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { configuracoes } = req.body;

    if (!configuracoes || typeof configuracoes !== 'object') {
      return res.status(400).json({ error: 'Configurações inválidas' });
    }

    await db.transaction(async (trx) => {
      const updates = Object.entries(configuracoes).map(([chave, valor]) => {
        return trx('configuracoes')
          .where({ chave })
          .update({
            valor,
            updated_at: trx.fn.now()
          });
      });
      await Promise.all(updates);
    });

    res.json({ message: 'Configurações atualizadas com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    res.status(500).json({ error: 'Erro ao atualizar configurações' });
  }
});

// Rota para gerenciar agendamentos
router.get('/scheduler', authenticateToken, requireAdmin, (req, res) => {
  try {
    const schedulerService = require('../services/schedulerService');
    const agendamentos = schedulerService.listarAgendamentos();

    res.json({
      agendamentos,
      emailConfigurado: require('../services/emailService').isConfigurado()
    });
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para executar verificação manual
router.post('/scheduler/executar', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schedulerService = require('../services/schedulerService');
    await schedulerService.executarVerificacaoManual();

    res.json({ message: 'Verificação manual executada com sucesso' });
  } catch (error) {
    console.error('Erro ao executar verificação manual:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;