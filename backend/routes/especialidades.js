const express = require('express');
const router = express.Router();
const { db } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ─────────────────────────────────────────────────────────────────────────────
//  PJ — comissoes_tabela
// ─────────────────────────────────────────────────────────────────────────────

router.get('/pj', authenticateToken, asyncHandler(async (req, res) => {
  const rows = await db('comissoes_tabela').orderBy(['especialidade', 'unidade']);
  res.json(rows);
}));

router.post('/pj', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { especialidade, unidade, pct_sem_meta, pct_com_meta, valor_fixo_base, meta_mensal, nao_possui_meta, nao_possui_fixo } = req.body;
  if (!especialidade || !unidade) return res.status(400).json({ error: 'especialidade e unidade são obrigatórios' });

  const metaVal = nao_possui_meta ? null : (parseFloat(meta_mensal) || null);
  const fixoVal = nao_possui_fixo ? 0 : (parseFloat(valor_fixo_base) || 0);

  const [id] = await db('comissoes_tabela').insert({
    especialidade: especialidade.trim(),
    unidade: unidade.trim().toUpperCase(),
    pct_sem_meta: parseFloat(pct_sem_meta) || 0,
    pct_com_meta: parseFloat(pct_com_meta) || 0,
    valor_fixo_base: fixoVal,
    meta_mensal: metaVal,
    tipo_contrato: 'prestador',
    ativo: 1,
  });
  const row = await db('comissoes_tabela').where('id', id).first();
  res.status(201).json(row);
}));

router.put('/pj/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { especialidade, unidade, pct_sem_meta, pct_com_meta, valor_fixo_base, meta_mensal, nao_possui_meta, nao_possui_fixo, ativo } = req.body;

  const updates = {};
  if (especialidade !== undefined) updates.especialidade = especialidade.trim();
  if (unidade !== undefined) updates.unidade = unidade.trim().toUpperCase();
  if (pct_sem_meta !== undefined) updates.pct_sem_meta = parseFloat(pct_sem_meta) || 0;
  if (pct_com_meta !== undefined) updates.pct_com_meta = parseFloat(pct_com_meta) || 0;
  if (ativo !== undefined) updates.ativo = ativo ? 1 : 0;

  if (nao_possui_fixo !== undefined) updates.valor_fixo_base = nao_possui_fixo ? 0 : (parseFloat(valor_fixo_base) || 0);
  else if (valor_fixo_base !== undefined) updates.valor_fixo_base = parseFloat(valor_fixo_base) || 0;

  if (nao_possui_meta !== undefined) updates.meta_mensal = nao_possui_meta ? null : (parseFloat(meta_mensal) || null);
  else if (meta_mensal !== undefined) updates.meta_mensal = parseFloat(meta_mensal) || null;

  await db('comissoes_tabela').where('id', id).update(updates);

  // Propagar valor_fixo_base para vínculos desta especialidade+unidade (quando fixo foi alterado)
  if (updates.valor_fixo_base !== undefined) {
    const row = await db('comissoes_tabela').where('id', id).first();
    if (row) {
      await db('prestador_vinculos')
        .where({ especialidade: row.especialidade, unidade: row.unidade })
        .update({ valor_fixo_base: updates.valor_fixo_base });
    }
  }

  const updated = await db('comissoes_tabela').where('id', id).first();
  res.json(updated);
}));

router.delete('/pj/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  await db('comissoes_tabela').where('id', id).delete();
  res.json({ ok: true });
}));

// ─────────────────────────────────────────────────────────────────────────────
//  CLT — especialidades_clt
// ─────────────────────────────────────────────────────────────────────────────

router.get('/clt', authenticateToken, asyncHandler(async (req, res) => {
  const rows = await db('especialidades_clt').orderBy('especialidade');
  res.json(rows);
}));

router.post('/clt', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { especialidade, label, meta_mensal, salario_base, nao_possui_meta, nao_possui_salario,
    pct_com_meta, pct_meta_extra, limiar_meta_extra, desconto_por_falta, tem_calculo_automatico, observacoes } = req.body;
  if (!especialidade) return res.status(400).json({ error: 'especialidade é obrigatória' });

  const metaVal = nao_possui_meta ? null : (parseFloat(meta_mensal) || 0);
  const salarioVal = nao_possui_salario ? 0 : (parseFloat(salario_base) || 0);

  const [id] = await db('especialidades_clt').insert({
    especialidade: especialidade.trim(),
    label: label || especialidade.trim(),
    meta_mensal: metaVal,
    salario_base: salarioVal,
    pct_com_meta: parseFloat(pct_com_meta) || 0,
    pct_meta_extra: parseFloat(pct_meta_extra) || 0,
    limiar_meta_extra: parseFloat(limiar_meta_extra) || 0,
    desconto_por_falta: parseFloat(desconto_por_falta) || 0,
    tem_calculo_automatico: tem_calculo_automatico ? 1 : 0,
    observacoes: observacoes || null,
    ativo: 1,
  });
  const row = await db('especialidades_clt').where('id', id).first();
  res.status(201).json(row);
}));

router.put('/clt/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nao_possui_meta, nao_possui_salario, meta_mensal, salario_base } = req.body;

  const updates = {};
  const campos = ['especialidade', 'label', 'pct_com_meta', 'pct_meta_extra',
    'limiar_meta_extra', 'desconto_por_falta', 'tem_calculo_automatico',
    'observacoes', 'ativo'];
  for (const campo of campos) {
    if (req.body[campo] === undefined) continue;
    if (['pct_com_meta', 'pct_meta_extra', 'limiar_meta_extra', 'desconto_por_falta'].includes(campo)) {
      updates[campo] = parseFloat(req.body[campo]) || 0;
    } else if (['tem_calculo_automatico', 'ativo'].includes(campo)) {
      updates[campo] = req.body[campo] ? 1 : 0;
    } else {
      updates[campo] = req.body[campo];
    }
  }
  if (nao_possui_meta !== undefined) updates.meta_mensal = nao_possui_meta ? null : (parseFloat(meta_mensal) || 0);
  else if (meta_mensal !== undefined) updates.meta_mensal = parseFloat(meta_mensal) || 0;
  if (nao_possui_salario !== undefined) updates.salario_base = nao_possui_salario ? 0 : (parseFloat(salario_base) || 0);
  else if (salario_base !== undefined) updates.salario_base = parseFloat(salario_base) || 0;

  await db('especialidades_clt').where('id', id).update(updates);
  const updated = await db('especialidades_clt').where('id', id).first();
  res.json(updated);
}));

router.delete('/clt/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  await db('especialidades_clt').where('id', id).delete();
  res.json({ ok: true });
}));

module.exports = router;
