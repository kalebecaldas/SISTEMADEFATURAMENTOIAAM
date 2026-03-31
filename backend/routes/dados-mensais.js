const express = require('express');
const { db } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /api/dados-mensais/resumo/:mes/:ano
 * Retorna todos os profissionais do mês/ano separados por CLT e PJ.
 * DEVE vir ANTES de /:prestadorId/:mes/:ano para não ser capturada por ela.
 */
router.get('/resumo/:mes/:ano', authenticateToken, asyncHandler(async (req, res) => {
    const { mes, ano } = req.params;
    const mesInt = parseInt(mes);
    const anoInt = parseInt(ano);

    if (req.user.tipo !== 'admin' && req.user.tipo !== 'master') {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const registros = await db('dados_mensais as dm')
        .join('usuarios as u', 'dm.prestador_id', 'u.id')
        .leftJoin('prestador_vinculos as pv', 'dm.vinculo_id', 'pv.id')
        .where({ 'dm.mes': mesInt, 'dm.ano': anoInt })
        .select(
            'dm.id',
            'u.nome',
            'dm.especialidade',
            'dm.unidade',
            'dm.turno',
            'dm.tipo_colaborador',
            'dm.valor_clinica',
            'dm.valor_clinica_meta',
            'dm.valor_profissional',
            'dm.valor_prof_part_oab',
            'dm.valor_fixo',
            'dm.extras',
            'dm.meta_batida',
            'dm.meta_mensal',
            'dm.faltas',
            'dm.valor_bruto',
            'dm.foi_editado',
            'dm.observacoes_edicao',
            'pv.valor_fixo_base',
        )
        .orderBy(['dm.tipo_colaborador', 'u.nome']);

    const clt = registros.filter(r => r.tipo_colaborador === 'clt');
    const pj  = registros.filter(r => r.tipo_colaborador !== 'clt');

    const soma    = (lista) => lista.reduce((s, r) => s + (r.valor_bruto  || 0), 0);
    const somaCli = (lista) => lista.reduce((s, r) => s + (r.valor_clinica || 0), 0);

    res.json({
        mes: mesInt,
        ano: anoInt,
        clt: {
            registros: clt,
            total_valor_bruto:   soma(clt),
            total_valor_clinica: somaCli(clt),
            quantidade: clt.length,
        },
        pj: {
            registros: pj,
            total_valor_bruto:   soma(pj),
            total_valor_clinica: somaCli(pj),
            quantidade: pj.length,
        },
        total_geral: soma(clt) + soma(pj),
    });
}));

/**
 * GET /api/dados-mensais/relatorio-turnos/:ano
 * Relatório anual de turnos por profissional.
 * Mostra mês a mês se o profissional trabalhou MANHÃ, TARDE ou AMBOS.
 */
router.get('/relatorio-turnos/:ano', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.tipo !== 'admin' && req.user.tipo !== 'master') {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const anoInt = parseInt(req.params.ano);

    const registros = await db('dados_mensais as dm')
        .join('usuarios as u', 'dm.prestador_id', 'u.id')
        .leftJoin('prestador_vinculos as pv', 'dm.vinculo_id', 'pv.id')
        .where('dm.ano', anoInt)
        .select(
            'u.id as prestador_id',
            'u.nome',
            'dm.mes',
            'dm.ano',
            'dm.especialidade',
            'dm.unidade',
            'dm.turno',
            'dm.turno_manha',
            'dm.turno_tarde',
            'dm.tipo_colaborador',
            'dm.valor_bruto',
        )
        .orderBy(['u.nome', 'dm.mes']);

    // Agrupar por profissional
    const porProfissional = new Map();
    for (const r of registros) {
        const key = `${r.prestador_id}|${r.especialidade || ''}|${r.unidade || ''}`;
        if (!porProfissional.has(key)) {
            porProfissional.set(key, {
                prestador_id: r.prestador_id,
                nome: r.nome,
                especialidade: r.especialidade || '-',
                unidade: r.unidade || '-',
                tipo_colaborador: r.tipo_colaborador,
                meses: {},
            });
        }
        const p = porProfissional.get(key);
        p.meses[r.mes] = {
            turno: r.turno || 'integral',
            turno_manha: !!r.turno_manha,
            turno_tarde: !!r.turno_tarde,
            valor_bruto: r.valor_bruto || 0,
        };
    }

    const resultado = [...porProfissional.values()].sort((a, b) => a.nome.localeCompare(b.nome));

    res.json({
        ano: anoInt,
        total: resultado.length,
        profissionais: resultado,
    });
}));

/**
 * PUT /api/dados-mensais/:id
 * Edita um registro individual (valor_clinica, faltas, valor_bruto, observacao).
 * Recalcula meta_batida automaticamente com base no novo valor_clinica.
 */
router.put('/:id', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.tipo !== 'admin' && req.user.tipo !== 'master') {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const { valor_clinica, faltas, valor_fixo, extras, valor_bruto, observacoes_edicao } = req.body;

    const registro = await db('dados_mensais as dm')
        .leftJoin('prestador_vinculos as pv', 'dm.vinculo_id', 'pv.id')
        .where('dm.id', id)
        .select('dm.*', 'pv.meta_mensal')
        .first();

    if (!registro) {
        return res.status(404).json({ error: 'Registro não encontrado' });
    }

    const novoValorClinica = valor_clinica !== undefined ? parseFloat(valor_clinica) : registro.valor_clinica;
    const novasFaltas = faltas !== undefined ? parseInt(faltas) : registro.faltas;
    const novoValorFixo = valor_fixo !== undefined ? parseFloat(valor_fixo) : registro.valor_fixo;
    const novosExtras = extras !== undefined ? parseFloat(extras) : (registro.extras || 0);
    const novoValorBruto = valor_bruto !== undefined ? parseFloat(valor_bruto) : registro.valor_bruto;

    // Recalcular meta_batida automaticamente
    const metaMensal = registro.meta_mensal || 0;
    const metaBatida = metaMensal > 0 && novoValorClinica >= metaMensal ? 1 : 0;

    await db('dados_mensais').where('id', id).update({
        valor_clinica: novoValorClinica,
        faltas: novasFaltas,
        valor_fixo: novoValorFixo,
        extras: novosExtras,
        valor_bruto: novoValorBruto,
        valor_liquido: novoValorBruto,
        meta_batida: metaBatida,
        foi_editado: 1,
        observacoes_edicao: observacoes_edicao || registro.observacoes_edicao || null,
    });

    const atualizado = await db('dados_mensais').where('id', id).first();
    res.json({ sucesso: true, registro: atualizado });
}));

/**
 * GET /api/dados-mensais/:prestadorId/historico
 * Buscar histórico completo de um prestador
 */
router.get('/:prestadorId/historico', authenticateToken, asyncHandler(async (req, res) => {
    const { prestadorId } = req.params;
    const user = req.user;

    if (user.tipo !== 'admin' && user.id !== parseInt(prestadorId)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const historico = await db('dados_mensais')
        .select('*')
        .where({ prestador_id: prestadorId })
        .orderBy([
            { column: 'ano',  order: 'desc' },
            { column: 'mes',  order: 'desc' }
        ]);

    res.json({ historico, total: historico.length });
}));

/**
 * GET /api/dados-mensais/:prestadorId/:mes/:ano
 * Buscar dados mensais de um prestador específico
 */
router.get('/:prestadorId/:mes/:ano', authenticateToken, asyncHandler(async (req, res) => {
    const { prestadorId, mes, ano } = req.params;
    const user = req.user;

    if (user.tipo !== 'admin' && user.id !== parseInt(prestadorId)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const dados = await db('dados_mensais as dm')
        .leftJoin('usuarios as editor', 'dm.editado_por', 'editor.id')
        .select('dm.*', 'editor.nome as editor_nome')
        .where({
            'dm.prestador_id': prestadorId,
            'dm.mes': parseInt(mes),
            'dm.ano': parseInt(ano)
        })
        .first();

    if (!dados) {
        return res.status(404).json({ error: 'Dados não encontrados para este período' });
    }

    const prestador = await db('usuarios')
        .select('meta_mensal')
        .where({ id: prestadorId })
        .first();

    res.json({
        ...dados,
        meta_mensal: prestador?.meta_mensal || dados.meta_mensal || 5000
    });
}));

module.exports = router;
