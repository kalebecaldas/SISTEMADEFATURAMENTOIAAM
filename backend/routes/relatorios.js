const express = require('express');
const { db } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * Estatísticas gerais
 */
router.get('/stats', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    // Total de prestadores (todos, independente de status — é estatística histórica)
    const totalPrestadores = await db('usuarios')
        .where({ tipo: 'prestador' })
        .count('* as count')
        .first();

    // Meses com mais metas batidas
    const mesesComMetas = await db('dados_mensais')
        .select(
            'mes',
            'ano',
            db.raw('COUNT(*) as total'),
            db.raw('SUM(CASE WHEN meta_batida = 1 THEN 1 ELSE 0 END) as metas_batidas')
        )
        .groupBy('mes', 'ano')
        .orderBy('metas_batidas', 'desc')
        .limit(6);

    // Média de faturamento (3, 6, 12 meses) - apenas meses passados
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    console.log(`📊 Calculando médias de FATURAMENTO (SOMA/PERÍODOS) - Mês atual: ${mesAtual}/${anoAtual}`);

    // Calcular data de 3 meses atrás
    let mes3Atras = mesAtual - 2;
    let ano3Atras = anoAtual;
    if (mes3Atras <= 0) {
        mes3Atras += 12;
        ano3Atras--;
    }

    // Calcular data de 6 meses atrás
    let mes6Atras = mesAtual - 5;
    let ano6Atras = anoAtual;
    if (mes6Atras <= 0) {
        mes6Atras += 12;
        ano6Atras--;
    }

    // Calcular data de 12 meses atrás
    let mes12Atras = mesAtual;
    let ano12Atras = anoAtual - 1;

    console.log(`📊 Períodos: 3M(${mes3Atras}/${ano3Atras}-${mesAtual}/${anoAtual}) 6M(${mes6Atras}/${ano6Atras}-${mesAtual}/${anoAtual}) 12M(${mes12Atras}/${ano12Atras}-${mesAtual}/${anoAtual})`);

    // Soma total 3 meses - FATURAMENTO
    const soma3Meses = await db('dados_mensais')
        .sum('valor_clinica as total')
        .where(function () {
            this.where(function () {
                this.where('ano', anoAtual).andWhere('mes', '<=', mesAtual).andWhere('mes', '>=', mes3Atras);
            });
            if (ano3Atras < anoAtual) {
                this.orWhere(function () {
                    this.where('ano', ano3Atras).andWhere('mes', '>=', mes3Atras);
                });
            }
        })
        .first();

    // Soma total 6 meses - FATURAMENTO
    const soma6Meses = await db('dados_mensais')
        .sum('valor_clinica as total')
        .where(function () {
            this.where(function () {
                this.where('ano', anoAtual).andWhere('mes', '<=', mesAtual).andWhere('mes', '>=', mes6Atras);
            });
            if (ano6Atras < anoAtual) {
                this.orWhere(function () {
                    this.where('ano', ano6Atras).andWhere('mes', '>=', mes6Atras);
                });
            }
        })
        .first();

    // Soma total 12 meses - FATURAMENTO
    const soma12Meses = await db('dados_mensais')
        .sum('valor_clinica as total')
        .where(function () {
            this.where(function () {
                this.where('ano', anoAtual).andWhere('mes', '<=', mesAtual);
            }).orWhere(function () {
                this.where('ano', ano12Atras).andWhere('mes', '>', mesAtual);
            });
        })
        .first();

    // Calcular médias dividindo pelo número de meses
    const media3 = (soma3Meses?.total || 0) / 3;
    const media6 = (soma6Meses?.total || 0) / 6;
    const media12 = (soma12Meses?.total || 0) / 12;

    console.log(`📊 Totais: 3M=${soma3Meses?.total?.toFixed(2)} 6M=${soma6Meses?.total?.toFixed(2)} 12M=${soma12Meses?.total?.toFixed(2)}`);
    console.log(`📊 Médias de FATURAMENTO: 3M=${media3.toFixed(2)} 6M=${media6.toFixed(2)} 12M=${media12.toFixed(2)}`);

    res.json({
        totalPrestadores: totalPrestadores.count,
        mesesComMetas,
        medias: {
            tres_meses: parseFloat(media3),
            seis_meses: parseFloat(media6),
            doze_meses: parseFloat(media12)
        }
    });
}));

/**
 * Ranking de prestadores
 */
router.get('/ranking/:mes/:ano', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { mes, ano } = req.params;

    // Agrupar por profissional — quem tem múltiplos vínculos (manhã+tarde) não deve
    // ocupar 2 posições no ranking com valores parciais.
    const ranking = await db('dados_mensais as dm')
        .join('usuarios as u', 'dm.prestador_id', 'u.id')
        .select('u.nome', 'u.email', 'u.especialidade')
        .sum('dm.valor_liquido as valor_liquido')
        .max('dm.meta_batida as meta_batida')
        .sum('dm.faltas as faltas')
        .where({
            'dm.mes': parseInt(mes),
            'dm.ano': parseInt(ano),
        })
        .groupBy('u.id', 'u.nome', 'u.email', 'u.especialidade')
        .orderBy('valor_liquido', 'desc')
        .limit(10);

    res.json(ranking);
}));

/**
 * Evolução mensal de um prestador
 */
router.get('/evolucao/:prestadorId', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { prestadorId } = req.params;
    const { meses = 12 } = req.query;

    const evolucao = await db('dados_mensais')
        .select('mes', 'ano', 'valor_liquido', 'meta_batida', 'faltas')
        .where({ prestador_id: prestadorId })
        .orderBy([
            { column: 'ano', order: 'desc' },
            { column: 'mes', order: 'desc' }
        ])
        .limit(parseInt(meses));

    res.json(evolucao.reverse());
}));

/**
 * Relatório customizado por período
 */
router.get('/customizado', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { mesInicio, anoInicio, mesesPeriodo } = req.query;

    if (!mesInicio || !anoInicio || !mesesPeriodo) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios: mesInicio, anoInicio, mesesPeriodo' });
    }

    const inicio = { mes: parseInt(mesInicio), ano: parseInt(anoInicio) };
    const periodo = parseInt(mesesPeriodo);

    if (Number.isNaN(inicio.mes) || inicio.mes < 1 || inicio.mes > 12) {
        return res.status(400).json({ error: 'mesInicio inválido — deve ser entre 1 e 12' });
    }
    if (Number.isNaN(inicio.ano) || inicio.ano < 2000 || inicio.ano > 2100) {
        return res.status(400).json({ error: 'anoInicio inválido' });
    }
    if (Number.isNaN(periodo) || periodo < 1 || periodo > 60) {
        return res.status(400).json({ error: 'mesesPeriodo inválido — deve ser entre 1 e 60' });
    }

    // Calcular mês/ano final
    let mesFim = inicio.mes + periodo - 1;
    let anoFim = inicio.ano;
    while (mesFim > 12) {
        mesFim -= 12;
        anoFim++;
    }

    console.log(`📊 Relatório Customizado - Período: ${inicio.mes}/${inicio.ano} a ${mesFim}/${anoFim}`);

    // Buscar todos os dados do período
    const dados = await db('dados_mensais as dm')
        .join('usuarios as u', 'dm.prestador_id', 'u.id')
        .leftJoin('prestador_vinculos as pv', 'dm.vinculo_id', 'pv.id')
        .select(
            'u.id as prestador_id',
            'u.nome',
            'u.email',
            'u.especialidade',
            'pv.turno',
            'pv.especialidade as vinculo_especialidade',
            'pv.unidade as vinculo_unidade',
            'dm.especialidade as dado_especialidade',
            'dm.mes',
            'dm.ano',
            'dm.tipo_colaborador',
            'dm.valor_liquido',
            'dm.valor_clinica',
            'dm.valor_clinica_total',
            'dm.valor_profissional',
            'dm.valor_fixo',
            'dm.faltas',
            'dm.meta_batida'
        )
        .where(function () {
            // Período dentro do mesmo ano
            if (inicio.ano === anoFim) {
                this.where('dm.ano', inicio.ano)
                    .andWhere('dm.mes', '>=', inicio.mes)
                    .andWhere('dm.mes', '<=', mesFim);
            } else {
                // Período atravessa anos
                this.where(function () {
                    this.where('dm.ano', inicio.ano).andWhere('dm.mes', '>=', inicio.mes);
                }).orWhere(function () {
                    this.where('dm.ano', anoFim).andWhere('dm.mes', '<=', mesFim);
                }).orWhere(function () {
                    this.where('dm.ano', '>', inicio.ano).andWhere('dm.ano', '<', anoFim);
                });
            }
        })
        .orderBy(['u.nome', 'dm.ano', 'dm.mes']);

    console.log(`📊 Dados encontrados: ${dados.length} registros`);

    // Agrupar por prestador (email + turno para diferenciar)
    const prestadoresMap = new Map();

    for (const dado of dados) {
        // Usar email + turno como chave única
        const key = `${dado.email}_${dado.turno || 'INTEGRAL'}`;

        if (!prestadoresMap.has(key)) {
            // Montar nome com turno se existir e for válido (não INDEFINIDO)
            // INDEFINIDO deve aparecer apenas na coluna de turnos, não no nome
            let nomeCompleto = dado.nome;
            const turnosValidos = ['MANHÃ', 'TARDE', 'NOITE', 'INTEGRAL'];
            if (dado.turno && turnosValidos.includes(dado.turno.toUpperCase())) {
                nomeCompleto = `${dado.nome} (${dado.turno})`;
            }
            // Se turno for INDEFINIDO ou vazio, usar apenas o nome sem adicionar turno

            prestadoresMap.set(key, {
                id: dado.prestador_id,
                nome: nomeCompleto,
                nome_base: dado.nome,
                email: dado.email,
                turno: dado.turno || 'INTEGRAL',
                // Prioridade: especialidade do registro daquele mês > vínculo > cadastro do usuário
                especialidade: dado.dado_especialidade || dado.vinculo_especialidade || dado.especialidade,
                unidade: dado.vinculo_unidade,
                meses_trabalhados: [],
                total_recebido: 0,
                total_faturado: 0
            });
        }

        const prestador = prestadoresMap.get(key);

        // CLT usa faturamento total (inclui Part/OAB); PJ usa valor_clinica (exclui Part/OAB)
        const faturadoDoMes = dado.tipo_colaborador === 'clt'
            ? (parseFloat(dado.valor_clinica_total) || parseFloat(dado.valor_clinica) || 0)
            : (parseFloat(dado.valor_clinica) || 0);

        // Adicionar mês trabalhado
        prestador.meses_trabalhados.push({
            mes: dado.mes,
            ano: dado.ano,
            turno: dado.turno,
            tipo_colaborador: dado.tipo_colaborador,
            valor_liquido: parseFloat(dado.valor_liquido) || 0,
            valor_clinica: faturadoDoMes,
            valor_profissional: parseFloat(dado.valor_profissional) || 0,
            valor_fixo: parseFloat(dado.valor_fixo) || 0,
            faltas: dado.faltas || 0,
            meta_batida: dado.meta_batida || false
        });

        prestador.total_recebido += parseFloat(dado.valor_liquido) || 0;
        prestador.total_faturado += faturadoDoMes;
    }

    // Converter Map para array e calcular médias
    const prestadores = Array.from(prestadoresMap.values()).map(p => {
        const totalMeses = p.meses_trabalhados.length;
        return {
            ...p,
            total_meses: totalMeses,
            media_salarial: totalMeses > 0 ? p.total_recebido / totalMeses : 0,
            media_faturamento: totalMeses > 0 ? p.total_faturado / totalMeses : 0
        };
    });

    // Calcular totais gerais
    const totais = {
        prestadores: prestadores.length,
        total_pago: prestadores.reduce((sum, p) => sum + p.total_recebido, 0),
        total_faturado: prestadores.reduce((sum, p) => sum + p.total_faturado, 0),
        media_salarial_geral: 0,
        media_faturamento_geral: 0
    };

    if (prestadores.length > 0) {
        totais.media_salarial_geral = totais.total_pago / prestadores.reduce((sum, p) => sum + p.total_meses, 0);
        totais.media_faturamento_geral = totais.total_faturado / prestadores.reduce((sum, p) => sum + p.total_meses, 0);
    }

    res.json({
        periodo: {
            inicio: `${String(inicio.mes).padStart(2, '0')}/${inicio.ano}`,
            fim: `${String(mesFim).padStart(2, '0')}/${anoFim}`,
            meses: periodo
        },
        prestadores,
        totais
    });
}));

module.exports = router;
