const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { db } = require('../database/init');
// Nota: db também pode vir de require('../database/connection') diretamente
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  processarAtendimentos,
  recalcularItem,
  detectarTipoContrato,
  detectarMesAno,
} = require('../services/calculoAtendimentos');

const router = express.Router();

// Configuração do multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/atendimentos');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'atend-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.xlsm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos Excel (.xlsx, .xls, .xlsm) são permitidos'), false);
    }
  },
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
});

/**
 * POST /api/atendimentos/analisar
 * Faz upload, lê a aba Atendimentos, detecta CLT/PJ, agrega e retorna preview sem salvar.
 */
router.post('/analisar', authenticateToken, requireAdmin, upload.single('planilha'), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    filePath = req.file.path;
    const { tipo_contrato_forcado } = req.body;

    const workbook = XLSX.readFile(filePath, { cellDates: false, raw: true });

    // Encontrar aba Atendimentos (case-insensitive)
    const abaName = workbook.SheetNames.find(
      n => n.toLowerCase().trim() === 'atendimentos'
    );
    if (!abaName) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        error: `Aba "Atendimentos" não encontrada. Abas disponíveis: ${workbook.SheetNames.join(', ')}`,
      });
    }

    const sheet = workbook.Sheets[abaName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    if (!rows || rows.length < 2) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'A aba Atendimentos está vazia ou sem dados' });
    }

    // Validar cabeçalho esperado
    const header = rows[0] || [];
    const expectedHeaders = ['Data', 'Hora', 'Paciente'];
    const missingHeaders = expectedHeaders.filter(h => !header.includes(h));
    if (missingHeaders.length > 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        error: `Formato inválido. Colunas esperadas não encontradas: ${missingHeaders.join(', ')}`,
      });
    }

    // Processar
    const resultado = await processarAtendimentos(rows, tipo_contrato_forcado || null);

    // Limpar arquivo temporário
    fs.unlinkSync(filePath);

    // ── Detectar conflitos CLT (só quando a planilha for PJ) ────────────────
    let conflitos_clt = [];
    if (resultado.tipo_contrato !== 'clt' && resultado.calculados.length > 0) {
      const mes = resultado.mes;
      const ano = resultado.ano;

      // IDs dos profissionais PJ reconhecidos
      const prestadorIds = [...new Set(resultado.calculados.map(c => c.prestador_id).filter(Boolean))];

      if (prestadorIds.length > 0) {
        // Verificar se algum desses profissionais tem vínculo CLT ativo
        const vincsClt = await db('prestador_vinculos')
          .whereIn('prestador_id', prestadorIds)
          .where('tipo_contrato', 'clt')
          .where('ativo', 1)
          .select('prestador_id', 'especialidade');

        // Verificar se algum tem dados_mensais CLT salvos para o mesmo mês/ano
        const dadosClt = await db('dados_mensais')
          .whereIn('prestador_id', prestadorIds)
          .where({ mes, ano, tipo_colaborador: 'clt' })
          .select('prestador_id', 'especialidade');

        const conflitandoPorId = new Map();
        for (const v of vincsClt) {
          conflitandoPorId.set(v.prestador_id, { tipo: 'vinculo_clt', especialidade: v.especialidade });
        }
        for (const d of dadosClt) {
          conflitandoPorId.set(d.prestador_id, { tipo: 'dados_mensais_clt', especialidade: d.especialidade });
        }

        if (conflitandoPorId.size > 0) {
          conflitos_clt = resultado.calculados
            .filter(c => conflitandoPorId.has(c.prestador_id))
            .map(c => ({
              prestador_id: c.prestador_id,
              nome: c.nome,
              especialidade: c.especialidade,
              unidade: c.unidade,
              turno: c.turno,
              motivo: conflitandoPorId.get(c.prestador_id)?.tipo,
            }));
        }
      }
    }

    return res.json({
      sucesso: true,
      tipo_contrato: resultado.tipo_contrato,
      mes: resultado.mes,
      ano: resultado.ano,
      total_atendimentos: rows.length - 1,
      calculados: resultado.calculados,
      nao_reconhecidos: resultado.nao_reconhecidos,
      conflitos_clt,
      resumo: {
        reconhecidos: resultado.calculados.length,
        nao_reconhecidos: resultado.nao_reconhecidos.length,
        revisao_manual: resultado.calculados.filter(c => c.revisao_manual).length,
        valor_total: resultado.calculados
          .filter(c => c.valor_bruto !== null)
          .reduce((s, c) => s + (c.valor_bruto || 0), 0),
      },
    });
  } catch (error) {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    console.error('❌ Erro ao analisar Atendimentos:', error);
    return res.status(500).json({ error: 'Erro ao processar planilha: ' + error.message });
  }
});

/**
 * POST /api/atendimentos/recalcular
 * Recalcula um item com novos valores de faltas/extras (chamado do frontend em tempo real).
 * O tipo_contrato vem do item.tipo_contrato (CLT ou PJ por profissional).
 */
router.post('/recalcular', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { item } = req.body;
    if (!item) {
      return res.status(400).json({ error: 'item é obrigatório' });
    }

    const recalculado = await recalcularItem(item);
    return res.json({ sucesso: true, item: recalculado });
  } catch (error) {
    console.error('❌ Erro ao recalcular item:', error);
    return res.status(500).json({ error: 'Erro ao recalcular: ' + error.message });
  }
});

/**
 * POST /api/atendimentos/confirmar
 * Salva os dados calculados em dados_mensais, persiste mapeamentos de nomes.
 */
router.post('/confirmar', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { calculados, mapeamentos_novos, tipo_contrato, mes, ano, substituir } = req.body;

    if (!calculados || !mes || !ano || !tipo_contrato) {
      return res.status(400).json({ error: 'calculados, mes, ano e tipo_contrato são obrigatórios' });
    }

    const mesInt = parseInt(mes);
    const anoInt = parseInt(ano);

    if (isNaN(mesInt) || isNaN(anoInt) || mesInt < 1 || mesInt > 12) {
      return res.status(400).json({ error: 'Mês ou ano inválido' });
    }

    // Verificar se já existem dados para o mês/ano/tipo
    const existentes = await db('dados_mensais')
      .where({ mes: mesInt, ano: anoInt, tipo_colaborador: tipo_contrato })
      .count('* as total')
      .first();

    if (parseInt(existentes.total) > 0 && !substituir) {
      return res.status(409).json({
        error: `Já existem dados para ${mesInt}/${anoInt} (${tipo_contrato}). Envie substituir=true para sobrescrever.`,
        existentes: parseInt(existentes.total),
      });
    }

    // Se substituir, deletar registros anteriores
    if (substituir && parseInt(existentes.total) > 0) {
      const deletados = await db('dados_mensais')
        .where({ mes: mesInt, ano: anoInt, tipo_colaborador: tipo_contrato })
        .delete();
      console.log(`🗑️  ${deletados} registros removidos para substituição`);
    }

    const ultimoDiaMes = new Date(anoInt, mesInt, 0).getDate();

    // Inserir em dados_mensais (cada item usa seu próprio tipo_contrato CLT/PJ)
    let inseridos = 0;
    const erros = [];

    for (const item of calculados) {
      if (!item.prestador_id || !item.vinculo_id) {
        erros.push(`Item sem prestador_id ou vinculo_id: ${item.nome}`);
        continue;
      }

      if (item.revisao_manual && (item.valor_bruto === null || item.valor_bruto === undefined)) {
        erros.push(`${item.nome}: valor em revisão manual não foi informado`);
        continue;
      }

      // Período de referência por profissional
      const tipoItem = item.tipo_contrato === 'clt' ? 'clt' : 'prestador';
      const diaInicio = tipoItem === 'clt' ? 26 : 1;
      const diaFim    = tipoItem === 'clt' ? 25 : ultimoDiaMes;

      try {
        // Determinar quais turnos esse profissional trabalhou neste mês
        const turnosMes = item._turnos_planilha instanceof Set
          ? item._turnos_planilha
          : new Set([item.turno_planilha || item.turno]);
        const temManha = turnosMes.has('MANHÃ') ? 1 : 0;
        const temTarde = turnosMes.has('TARDE') ? 1 : 0;

        // Para vínculos AMBOS, salvar o turno real da planilha (MANHÃ ou TARDE)
        // para que cada turno gere uma linha separada no resumo
        const vinculoTurno = (item.turno || '').toUpperCase();
        const turnoParaSalvar = vinculoTurno === 'AMBOS'
          ? (item.turno_planilha || item.turno || 'INDEFINIDO')
          : (item.turno || 'INDEFINIDO');

        // valor_clinica = Fat Clínica completo (soma Col M, inclui Part/OAB) — exibido ao usuário
        // valor_clinica_meta = base SEM Part/OAB — usado só para checar meta e fórmula (Part/OAB tem % diferente)
        const payload = {
          prestador_id: item.prestador_id,
          vinculo_id: item.vinculo_id,
          mes: mesInt,
          ano: anoInt,
          tipo_colaborador: tipoItem,
          dia_inicio: diaInicio,
          dia_fim: diaFim,
          valor_clinica: item.valor_clinica_total ?? item.valor_clinica ?? 0,
          valor_clinica_meta: item.valor_clinica ?? null,
          valor_profissional: item.valor_profissional_atend || 0,
          valor_prof_part_oab: item.valor_prof_part_oab || 0,
          meta_mensal: item.meta_mensal || null,
          valor_bruto: item.valor_bruto || 0,
          valor_liquido: item.valor_bruto || 0,
          valor_original: item.valor_bruto || 0,
          valor_fixo: item.fixo_ajustado || 0,
          faltas: item.faltas || 0,
          meta_batida: item.meta_batida ? 1 : 0,
          especialidade: item.especialidade || null,
          unidade: item.unidade || null,
          turno: turnoParaSalvar,
          turno_manha: temManha,
          turno_tarde: temTarde,
          observacoes_edicao: item.revisao_manual ? 'Revisão manual aplicada' : null,
          foi_editado: 0,
          created_at: db.fn.now(),
        };

        // Upsert: atualiza se já existir (vinculo_id + mes + ano + turno é único)
        await db('dados_mensais')
          .insert(payload)
          .onConflict(['vinculo_id', 'mes', 'ano', 'turno'])
          .merge({
            tipo_colaborador: payload.tipo_colaborador,
            dia_inicio: payload.dia_inicio,
            dia_fim: payload.dia_fim,
            valor_clinica: payload.valor_clinica,
            valor_clinica_meta: payload.valor_clinica_meta,
            valor_profissional: payload.valor_profissional,
            valor_prof_part_oab: payload.valor_prof_part_oab,
            meta_mensal: payload.meta_mensal,
            valor_bruto: payload.valor_bruto,
            valor_liquido: payload.valor_liquido,
            valor_original: payload.valor_original,
            valor_fixo: payload.valor_fixo,
            faltas: payload.faltas,
            meta_batida: payload.meta_batida,
            especialidade: payload.especialidade,
            unidade: payload.unidade,
            turno: payload.turno,
            turno_manha: payload.turno_manha,
            turno_tarde: payload.turno_tarde,
            observacoes_edicao: payload.observacoes_edicao,
            foi_editado: payload.foi_editado,
          });
        inseridos++;
      } catch (err) {
        erros.push(`Erro ao inserir ${item.nome}: ${err.message}`);
      }
    }

    // Persistir novos mapeamentos de nomes
    if (mapeamentos_novos && Array.isArray(mapeamentos_novos)) {
      for (const map of mapeamentos_novos) {
        if (!map.nome_planilha || !map.prestador_id) continue;
        await db('mapeamento_nomes')
          .insert({
            nome_planilha: map.nome_planilha,
            prestador_id: map.prestador_id,
            vinculo_id: map.vinculo_id || null,
          })
          .onConflict('nome_planilha')
          .merge({ prestador_id: map.prestador_id, vinculo_id: map.vinculo_id || null });
      }
      console.log(`✅ ${mapeamentos_novos.length} mapeamentos de nomes persistidos`);
    }

    return res.json({
      sucesso: true,
      inseridos,
      erros,
      mensagem: `${inseridos} registro(s) salvos com sucesso para ${mesInt}/${anoInt} (${tipo_contrato})`,
    });
  } catch (error) {
    console.error('❌ Erro ao confirmar Atendimentos:', error);
    return res.status(500).json({ error: 'Erro ao salvar dados: ' + error.message });
  }
});

/**
 * GET /api/atendimentos/prestadores
 * Lista prestadores com vínculos ativos para o mapeamento de nomes
 */
router.get('/prestadores', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { tipo_contrato } = req.query;

    const query = db('usuarios as u')
      .join('prestador_vinculos as pv', 'pv.prestador_id', 'u.id')
      .where('u.tipo', 'prestador')
      .where('pv.ativo', true)
      .select(
        'u.id as prestador_id', 'u.nome', 'u.email',
        'pv.id as vinculo_id', 'pv.especialidade', 'pv.unidade', 'pv.turno',
        'pv.tipo_contrato', 'pv.meta_mensal', 'pv.valor_fixo_base'
      )
      .orderBy('u.nome');

    if (tipo_contrato) {
      query.where('pv.tipo_contrato', tipo_contrato);
    }

    const prestadores = await query;
    return res.json(prestadores);
  } catch (error) {
    console.error('❌ Erro ao listar prestadores:', error);
    return res.status(500).json({ error: 'Erro ao listar prestadores' });
  }
});

/**
 * POST /api/atendimentos/prestadores/cadastro-rapido
 * Cadastra um novo prestador + vínculo direto da tela de mapeamento.
 * Body: { nome, email, especialidade, unidade, turno, tipo_contrato, meta_mensal, valor_fixo_base }
 */
router.post('/prestadores/cadastro-rapido', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      nome, email,
      especialidade = 'Fisio',
      unidade = 'MATRIZ',
      turno = 'INDEFINIDO',
      tipo_contrato = 'prestador',
      meta_mensal = null,
      valor_fixo_base = null,
    } = req.body;

    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    // Email gerado automaticamente se não fornecido
    const emailFinal = email || `${nome.toLowerCase().replace(/\s+/g, '.')}@cadastro-rapido.local`;

    // Verificar se já existe usuário com esse email
    let usuario = await db('usuarios').where('email', emailFinal).first();

    if (!usuario) {
      // Criar usuário
      const bcrypt = require('bcryptjs');
      const senhaTemp = Math.random().toString(36).slice(-8);
      const senhaHash = bcrypt.hashSync(senhaTemp, 10);

      const [id] = await db('usuarios').insert({
        nome: nome.trim(),
        email: emailFinal,
        senha: senhaHash,
        tipo: 'prestador',
        tipo_colaborador: tipo_contrato === 'clt' ? 'clt' : 'pj',
        ativo: true,
        cadastro_confirmado: true,
      });
      usuario = await db('usuarios').where('id', id).first();
    }

    // Criar vínculo
    const [vinculoId] = await db('prestador_vinculos').insert({
      prestador_id: usuario.id,
      tipo_contrato,
      especialidade,
      unidade,
      turno,
      meta_mensal: meta_mensal ? parseFloat(meta_mensal) : null,
      valor_fixo_base: valor_fixo_base ? parseFloat(valor_fixo_base) : null,
      desconto_por_falta: 20,
      ativo: 1,
    });

    return res.json({
      sucesso: true,
      prestador_id: usuario.id,
      vinculo_id: vinculoId,
      nome: usuario.nome,
      especialidade, unidade, turno, tipo_contrato,
    });
  } catch (error) {
    console.error('❌ Erro no cadastro rápido:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar: ' + error.message });
  }
});

/**
 * Mapeia (especialidade form, unidade) → especialidade na comissoes_tabela
 * Ex: Fisio + SÃO JOSÉ → SJFisio
 */
function espParaComissao(esp, unidade) {
  const u = (unidade || '').toUpperCase();
  const e = (esp || '').trim();
  if (u === 'SÃO JOSÉ') {
    if (e === 'Fisio') return 'SJFisio';
    if (e === 'Acup' || e === 'Acupuntura') return 'SJAcup';
    if (e === 'RPG') return 'SJRPG';
  }
  return e === 'Acupuntura' ? 'Acup' : e;
}

/**
 * GET /api/atendimentos/defaults-especialidade
 * Retorna meta_mensal e valor_fixo_base por especialidade + tipo_contrato.
 * Usa as tabelas especialidades_clt e comissoes_tabela (configuração de especialidades).
 */
router.get('/defaults-especialidade', authenticateToken, requireAdmin, async (req, res) => {
  const moda = (arr) => {
    if (!arr.length) return null;
    const freq = {};
    arr.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
    return parseFloat(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
  };

  // ─── CLT: da tabela especialidades_clt ─────────────────────────────────────
  const cltRows = await db('especialidades_clt').where('ativo', 1);
  const defaultsCLT = {};
  const especialidadesCLT = [];
  for (const r of cltRows) {
    const esp = r.especialidade || '';
    especialidadesCLT.push(esp);
    defaultsCLT[esp] = {
      meta_mensal: parseFloat(r.meta_mensal) || null,
      valor_fixo_base: null, // CLT não usa fixo por vínculo
    };
  }

  // ─── PJ: comissoes_tabela (fixo) + prestador_vinculos (meta moda) ───────────
  const comissoes = await db('comissoes_tabela').where('ativo', 1);
  const vinculos = await db('prestador_vinculos')
    .where('ativo', 1)
    .where('tipo_contrato', 'prestador')
    .select('especialidade', 'meta_mensal', 'valor_fixo_base');

  const pjMetaMap = {};
  for (const r of vinculos) {
    const esp = r.especialidade || 'Outros';
    if (!pjMetaMap[esp]) pjMetaMap[esp] = { metas: [], fixos: [] };
    if (r.meta_mensal) pjMetaMap[esp].metas.push(r.meta_mensal);
    if (r.valor_fixo_base) pjMetaMap[esp].fixos.push(r.valor_fixo_base);
  }

  // Mapa (especialidade, unidade) → valor_fixo_base e meta_mensal da comissoes_tabela
  const configPorEspUnidade = {};
  for (const c of comissoes) {
    const k = `${c.especialidade}|${c.unidade}`;
    configPorEspUnidade[k] = {
      valor_fixo_base: parseFloat(c.valor_fixo_base) || null,
      meta_mensal: c.meta_mensal != null ? parseFloat(c.meta_mensal) : null,
    };
  }

  const especialidadesPJ = [...new Set(comissoes.map(c => c.especialidade))];
  const ESP_FORM = ['Fisio', 'Fisio Pelv', 'Neuro', 'Acupuntura', 'Acup', 'RPG', 'Pilates', 'SJFisio', 'SJAcup', 'SJRPG'];

  const defaultsPJ = {};
  for (const esp of [...new Set([...ESP_FORM, ...especialidadesPJ])]) {
    defaultsPJ[esp] = { meta_mensal: null, valor_fixo_base: null, por_unidade: {} };

    // Meta: prioridade comissoes_tabela, fallback moda dos vínculos
    for (const unidade of ['MATRIZ', 'ANEXO', 'SÃO JOSÉ']) {
      const espComissao = espParaComissao(esp, unidade);
      const k = `${espComissao}|${unidade}`;
      const cfg = configPorEspUnidade[k];
      if (cfg?.meta_mensal != null && defaultsPJ[esp].meta_mensal == null) {
        defaultsPJ[esp].meta_mensal = cfg.meta_mensal;
      }
    }
    if (defaultsPJ[esp].meta_mensal == null) {
      const espMeta = esp === 'Acupuntura' ? 'Acup' : esp;
      const metaData = pjMetaMap[espMeta] || pjMetaMap[esp];
      if (metaData) defaultsPJ[esp].meta_mensal = moda(metaData.metas);
    }

    // Fixo e meta por unidade: da comissoes_tabela
    for (const unidade of ['MATRIZ', 'ANEXO', 'SÃO JOSÉ']) {
      const espComissao = espParaComissao(esp, unidade);
      const k = `${espComissao}|${unidade}`;
      const cfg = configPorEspUnidade[k];
      if (cfg) {
        const fixo = cfg.valor_fixo_base;
        const meta = cfg.meta_mensal;
        defaultsPJ[esp].por_unidade[unidade] = {
          valor_fixo_base: fixo != null ? fixo : null,
          meta_mensal: meta != null ? meta : null,
        };
        if (fixo != null && fixo > 0 && defaultsPJ[esp].valor_fixo_base == null) {
          defaultsPJ[esp].valor_fixo_base = fixo;
        }
      }
    }
  }

  res.json({
    clt: defaultsCLT,
    prestador: defaultsPJ,
    especialidades: [...new Set([...especialidadesCLT, ...ESP_FORM])].filter(Boolean).sort(),
  });
});

/**
 * GET /api/atendimentos/comissoes
 * Retorna a tabela de comissões configurada
 */
router.get('/comissoes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const comissoes = await db('comissoes_tabela').where({ ativo: true }).orderBy('especialidade');
    return res.json(comissoes);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao carregar comissões' });
  }
});

/**
 * POST /api/atendimentos/prestadores/:id/tornar-clt
 * Converte um profissional PJ em CLT: cria vínculo CLT e atualiza tipo_colaborador.
 * Idempotente: se já existe vínculo CLT para essa combinação, retorna 200 sem duplicar.
 *
 * Body: { especialidade, unidade, turno, meta_mensal, valor_fixo_base }
 */
router.post('/prestadores/:id/tornar-clt', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const prestadorId = parseInt(req.params.id);
    const {
      especialidade = 'Fisio',
      unidade = 'MATRIZ',
      turno = 'INDEFINIDO',
      meta_mensal = null,
      valor_fixo_base = null,
    } = req.body;

    if (!prestadorId || isNaN(prestadorId)) {
      return res.status(400).json({ error: 'ID de prestador inválido' });
    }

    // Verificar se o prestador existe
    const usuario = await db('usuarios').where('id', prestadorId).first();
    if (!usuario) {
      return res.status(404).json({ error: 'Prestador não encontrado' });
    }

    // Verificar se já existe vínculo CLT para essa combinação
    const vinculoExistente = await db('prestador_vinculos')
      .where({
        prestador_id: prestadorId,
        tipo_contrato: 'clt',
        especialidade,
        unidade,
        turno,
      })
      .where('ativo', true)
      .first();

    if (vinculoExistente) {
      return res.json({
        sucesso: true,
        mensagem: `${usuario.nome} já possui vínculo CLT para ${especialidade} ${turno} em ${unidade}`,
        vinculo_id: vinculoExistente.id,
        ja_existia: true,
      });
    }

    // Criar vínculo CLT
    const [vinculoId] = await db('prestador_vinculos').insert({
      prestador_id: prestadorId,
      tipo_contrato: 'clt',
      especialidade,
      unidade,
      turno,
      valor_fixo_base: valor_fixo_base ? parseFloat(valor_fixo_base) : null,
      desconto_por_falta: 20,
      meta_mensal: meta_mensal ? parseFloat(meta_mensal) : null,
      ativo: 1,
    });

    // Atualizar tipo_colaborador do usuario
    await db('usuarios').where('id', prestadorId).update({ tipo_colaborador: 'clt' });

    console.log(`✅ ${usuario.nome} convertido para CLT (${especialidade} ${turno} ${unidade})`);

    return res.json({
      sucesso: true,
      mensagem: `${usuario.nome} convertido para CLT com sucesso`,
      vinculo_id: vinculoId,
      ja_existia: false,
    });
  } catch (error) {
    console.error('❌ Erro ao tornar CLT:', error);
    return res.status(500).json({ error: 'Erro ao converter para CLT: ' + error.message });
  }
});

module.exports = router;
