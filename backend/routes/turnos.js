/**
 * Configuração de turnos de funcionamento, feriados e conferência de faltas.
 * Fases 2 a 4.
 */

const express = require('express');
const { db } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { feriadosDoPeriodo } = require('../utils/feriados');

const router = express.Router();

const DIAS_VALIDOS = new Set([1, 2, 3, 4, 5, 6, 7]);
const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Valida e normaliza o payload de um turno. Retorna { erro } ou { valor }. */
function validarTurno(body) {
  const { unidade, turno, hora_inicio, hora_fim } = body;
  if (!unidade || !turno) return { erro: 'unidade e turno são obrigatórios' };
  if (!HORA_RE.test(hora_inicio || '')) return { erro: 'hora_inicio deve estar no formato HH:MM' };
  if (!HORA_RE.test(hora_fim || '')) return { erro: 'hora_fim deve estar no formato HH:MM' };
  if (hora_fim <= hora_inicio) return { erro: 'hora_fim precisa ser maior que hora_inicio' };

  const dias = Array.isArray(body.dias_semana)
    ? body.dias_semana
    : String(body.dias_semana || '').split(',');
  const limpos = [...new Set(dias.map(d => parseInt(d, 10)).filter(d => DIAS_VALIDOS.has(d)))].sort();
  if (!limpos.length) return { erro: 'informe ao menos um dia da semana (1=segunda … 7=domingo)' };

  return {
    valor: {
      unidade: String(unidade).trim().toUpperCase(),
      turno: String(turno).trim().toUpperCase(),
      hora_inicio,
      hora_fim,
      dias_semana: limpos.join(','),
      vigencia_inicio: body.vigencia_inicio || null,
      vigencia_fim: body.vigencia_fim || null,
      ativo: body.ativo !== false,
    },
  };
}

// ─── Turnos ────────────────────────────────────────────────────────────────
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const turnos = await db('turnos_config').orderBy(['unidade', 'turno']);
    res.json({ turnos });
  } catch (e) {
    console.error('❌ Erro ao listar turnos:', e);
    res.status(500).json({ error: 'Erro ao listar turnos' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { erro, valor } = validarTurno(req.body);
    if (erro) return res.status(400).json({ error: erro });
    const [novo] = await db('turnos_config').insert(valor).returning('id');
    res.status(201).json({ sucesso: true, id: typeof novo === 'object' ? novo.id : novo });
  } catch (e) {
    console.error('❌ Erro ao criar turno:', e);
    res.status(500).json({ error: 'Erro ao criar turno' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { erro, valor } = validarTurno(req.body);
    if (erro) return res.status(400).json({ error: erro });
    const n = await db('turnos_config').where('id', req.params.id).update(valor);
    if (!n) return res.status(404).json({ error: 'Turno não encontrado' });
    res.json({ sucesso: true });
  } catch (e) {
    console.error('❌ Erro ao atualizar turno:', e);
    res.status(500).json({ error: 'Erro ao atualizar turno' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Desativa em vez de apagar: competências antigas precisam continuar
    // conseguindo reconstruir o calendário que valia na época.
    const n = await db('turnos_config').where('id', req.params.id).update({ ativo: false });
    if (!n) return res.status(404).json({ error: 'Turno não encontrado' });
    res.json({ sucesso: true, mensagem: 'Turno desativado' });
  } catch (e) {
    console.error('❌ Erro ao desativar turno:', e);
    res.status(500).json({ error: 'Erro ao desativar turno' });
  }
});

// ─── Feriados ──────────────────────────────────────────────────────────────
router.get('/feriados/lista', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ano } = req.query;
    let q = db('feriados').orderBy('data');
    if (ano) {
      q = q.whereBetween('data', [`${ano}-01-01`, `${ano}-12-31`]);
    }
    res.json({ feriados: await q });
  } catch (e) {
    console.error('❌ Erro ao listar feriados:', e);
    res.status(500).json({ error: 'Erro ao listar feriados' });
  }
});

router.post('/feriados', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, nome } = req.body;
    if (!data || !nome) return res.status(400).json({ error: 'data e nome são obrigatórios' });
    const [novo] = await db('feriados').insert({
      data,
      nome: String(nome).trim(),
      escopo: req.body.escopo || 'unidade',
      unidade: req.body.unidade || null,
      facultativo: !!req.body.facultativo,
      ativo: true,
    }).returning('id');
    res.status(201).json({ sucesso: true, id: typeof novo === 'object' ? novo.id : novo });
  } catch (e) {
    console.error('❌ Erro ao criar feriado:', e);
    res.status(500).json({ error: 'Erro ao criar feriado' });
  }
});

router.delete('/feriados/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const n = await db('feriados').where('id', req.params.id).update({ ativo: false });
    if (!n) return res.status(404).json({ error: 'Feriado não encontrado' });
    res.json({ sucesso: true });
  } catch (e) {
    console.error('❌ Erro ao remover feriado:', e);
    res.status(500).json({ error: 'Erro ao remover feriado' });
  }
});

/** Gera os feriados calculados de um ano que ainda não existem no banco. */
router.post('/feriados/gerar/:ano', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const ano = parseInt(req.params.ano, 10);
    if (!ano || ano < 2000 || ano > 2100) return res.status(400).json({ error: 'Ano inválido' });

    const calculados = feriadosDoPeriodo(ano, ano);
    const existentes = await db('feriados')
      .whereBetween('data', [`${ano}-01-01`, `${ano}-12-31`])
      .select('data', 'nome');
    const chaves = new Set(existentes.map(f => `${String(f.data).slice(0, 10)}|${f.nome}`));
    const novos = calculados.filter(f => !chaves.has(`${f.data}|${f.nome}`));

    if (novos.length) {
      await db('feriados').insert(novos.map(f => ({
        data: f.data, nome: f.nome, escopo: f.escopo, facultativo: f.facultativo, ativo: true,
      })));
    }
    res.json({ sucesso: true, inseridos: novos.length, ja_existiam: chaves.size });
  } catch (e) {
    console.error('❌ Erro ao gerar feriados:', e);
    res.status(500).json({ error: 'Erro ao gerar feriados' });
  }
});

// ─── Faltas ────────────────────────────────────────────────────────────────
router.get('/faltas/:mes/:ano', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const faltas = await db('faltas_detectadas as f')
      .join('usuarios as u', 'u.id', 'f.prestador_id')
      .where({ 'f.mes': parseInt(req.params.mes, 10), 'f.ano': parseInt(req.params.ano, 10) })
      .select('f.*', 'u.nome')
      .orderBy(['u.nome', 'f.data']);
    res.json({ faltas });
  } catch (e) {
    console.error('❌ Erro ao listar faltas:', e);
    res.status(500).json({ error: 'Erro ao listar faltas' });
  }
});

/**
 * Confirma ou descarta faltas em lote.
 * Body: { ids: number[], status: 'confirmada'|'descartada'|'justificada', justificativa? }
 */
router.put('/faltas/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ids, status, justificativa } = req.body;
    const VALIDOS = ['suspeita', 'confirmada', 'descartada', 'justificada'];
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids é obrigatório' });
    if (!VALIDOS.includes(status)) return res.status(400).json({ error: `status deve ser um de: ${VALIDOS.join(', ')}` });

    const n = await db('faltas_detectadas').whereIn('id', ids).update({
      status,
      justificativa: justificativa || null,
      confirmado_por: req.user.id,
      confirmado_em: db.fn.now(),
    });

    // dados_mensais.faltas passa a refletir só o que foi CONFIRMADO.
    const afetados = await db('faltas_detectadas').whereIn('id', ids).distinct('vinculo_id', 'mes', 'ano');
    for (const a of afetados) {
      const { total } = await db('faltas_detectadas')
        .where({ vinculo_id: a.vinculo_id, mes: a.mes, ano: a.ano, status: 'confirmada' })
        .count('* as total').first();
      await db('dados_mensais')
        .where({ vinculo_id: a.vinculo_id, mes: a.mes, ano: a.ano })
        .update({ faltas: parseInt(total, 10) || 0 });
    }

    res.json({ sucesso: true, atualizados: n });
  } catch (e) {
    console.error('❌ Erro ao atualizar faltas:', e);
    res.status(500).json({ error: 'Erro ao atualizar faltas' });
  }
});

module.exports = router;
