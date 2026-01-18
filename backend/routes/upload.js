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

const router = express.Router();

// Mapeamento de meses para nomes das abas
const MESES_ABAS = {
  1: 'JANEIRO',
  2: 'FEVEREIRO',
  3: 'MARÇO',
  4: 'ABRIL',
  5: 'MAIO',
  6: 'JUNHO',
  7: 'JULHO',
  8: 'AGOSTO',
  9: 'SETEMBRO',
  10: 'OUTUBRO',
  11: 'NOVEMBRO',
  12: 'DEZEMBRO'
};

// Funções auxiliares para detecção de turno
function detectarTurno(row, nomeColuna = 0, turnoColuna = 12) {
  // Prioridade 1: Coluna M (índice 12) se existir
  if (row[turnoColuna] && row[turnoColuna].toString().trim()) {
    return normalizarTurno(row[turnoColuna]);
  }

  // Prioridade 2: Detectar no nome
  const nome = row[nomeColuna] || '';
  if (/\(tarde\)/i.test(nome)) return 'TARDE';
  if (/\(manhã\)/i.test(nome) || /\(manha\)/i.test(nome)) return 'MANHÃ';

  // Padrão: INDEFINIDO (quando não há informação de turno)
  return 'INDEFINIDO';
}

function normalizarTurno(turno) {
  if (!turno) return 'INDEFINIDO';

  const turnoStr = turno.toString().toUpperCase().trim();
  const map = {
    'M': 'MANHÃ',
    'MANHA': 'MANHÃ',
    'MANHÃ': 'MANHÃ',
    'T': 'TARDE',
    'TARDE': 'TARDE',
    'N': 'NOITE',
    'NOITE': 'NOITE',
    'I': 'INTEGRAL',
    'INTEGRAL': 'INTEGRAL',
    'COMPLETO': 'INTEGRAL'
  };

  return map[turnoStr] || 'INDEFINIDO';
}

function limparNomeTurno(nome) {
  return nome
    .replace(/\s*\(tarde\)/i, '')
    .replace(/\s*\(manhã\)/i, '')
    .replace(/\s*\(manha\)/i, '')
    .trim();
}


// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
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
    const allowedTypes = ['.xlsx', '.xls', '.xlsm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos Excel são permitidos'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Verificar se já existe planilha para o mês/ano (separado por tipo)
router.get('/verificar/:mes/:ano', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { mes, ano } = req.params;
    const mesInt = parseInt(mes);
    const anoInt = parseInt(ano);

    // Buscar dados de PRESTADORES
    const dadosPrestadores = await db('dados_mensais')
      .where({ mes: mesInt, ano: anoInt, tipo_colaborador: 'prestador' })
      .count('* as total')
      .countDistinct('prestador_id as prestadores')
      .sum('valor_liquido as valor_total')
      .first();

    // Buscar dados de CLT
    const dadosCLT = await db('dados_mensais')
      .where({ mes: mesInt, ano: anoInt, tipo_colaborador: 'clt' })
      .count('* as total')
      .countDistinct('prestador_id as prestadores')
      .sum('valor_liquido as valor_total')
      .first();

    const existePrestadores = parseInt(dadosPrestadores.total) > 0;
    const existeCLT = parseInt(dadosCLT.total) > 0;

    // Calcular último dia do mês para prestadores
    const ultimoDiaMes = new Date(anoInt, mesInt, 0).getDate();

    const response = {
      prestadores: {
        existe: existePrestadores,
        total: parseInt(dadosPrestadores.total) || 0,
        colaboradores: parseInt(dadosPrestadores.prestadores) || 0,
        valor_total: parseFloat(dadosPrestadores.valor_total) || 0,
        periodo: {
          inicio: 1,
          fim: ultimoDiaMes
        }
      },
      clt: {
        existe: existeCLT,
        total: parseInt(dadosCLT.total) || 0,
        colaboradores: parseInt(dadosCLT.prestadores) || 0,
        valor_total: parseFloat(dadosCLT.valor_total) || 0,
        periodo: {
          inicio: 1,
          fim: 25
        }
      },
      consolidado: {
        total_registros: (parseInt(dadosPrestadores.total) || 0) + (parseInt(dadosCLT.total) || 0),
        total_colaboradores: (parseInt(dadosPrestadores.prestadores) || 0) + (parseInt(dadosCLT.prestadores) || 0),
        valor_total: (parseFloat(dadosPrestadores.valor_total) || 0) + (parseFloat(dadosCLT.valor_total) || 0)
      }
    };

    res.json(response);
  } catch (error) {
    console.error('❌ Erro ao verificar dados existentes:', error);
    res.status(500).json({ error: 'Erro ao verificar dados existentes' });
  }
});

/**
 * POST /api/upload/processar
 * Processa a planilha e retorna lista de prestadores novos vs existentes
 * Não salva nada no banco ainda - apenas análise
 * Aceita parâmetro tipo_colaborador: 'prestador' ou 'clt'
 */
router.post('/processar', authenticateToken, requireAdmin, upload.single('planilha'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const { mes, ano, tipo_colaborador = 'prestador' } = req.body;
    if (!mes || !ano) {
      return res.status(400).json({ error: 'Mês e ano são obrigatórios' });
    }

    if (!['prestador', 'clt'].includes(tipo_colaborador)) {
      return res.status(400).json({ error: 'Tipo de colaborador inválido. Use "prestador" ou "clt"' });
    }

    // Calcular período de referência
    const mesInt = parseInt(mes);
    const anoInt = parseInt(ano);
    const ultimoDiaMes = new Date(anoInt, mesInt, 0).getDate();

    const periodo = tipo_colaborador === 'clt'
      ? { inicio: 1, fim: 25 }
      : { inicio: 1, fim: ultimoDiaMes };

    console.log(`\n📊 PROCESSANDO PLANILHA: ${mes}/${ano} - ${tipo_colaborador.toUpperCase()}`);
    console.log(`📁 Arquivo: ${req.file.filename}`);
    console.log(`📅 Período: ${periodo.inicio} a ${periodo.fim}`);


    const workbook = XLSX.readFile(req.file.path);
    const mesNome = MESES_ABAS[parseInt(mes)];

    // Listar abas disponíveis
    console.log(`📋 Abas disponíveis: ${workbook.SheetNames.join(', ')}`);
    console.log(`🔍 Procurando aba: ${mesNome}`);

    // Buscar aba (case-insensitive)
    let sheet = workbook.Sheets[mesNome];
    if (!sheet) {
      // Tentar busca case-insensitive
      const sheetName = workbook.SheetNames.find(name =>
        name.toUpperCase() === mesNome.toUpperCase()
      );
      if (sheetName) {
        sheet = workbook.Sheets[sheetName];
        console.log(`✅ Aba encontrada: ${sheetName}`);
      }
    }

    if (!sheet) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: `Aba "${mesNome}" não encontrada. Abas disponíveis: ${workbook.SheetNames.join(', ')}`
      });
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

      // Mapeamento CORRETO das colunas (confirmado pelo usuário):
      // A (0): Nome do prestador
      // B (1): Especialidade
      // C (2): Unidade
      // D (3): Valor Total Faturado (valor_clinica)
      // E (4): Valor Profissional
      // F (5): Valor Fixo
      // G (6): Meta a ser batida
      // K (10): Faltas
      // L (11): Email
      // M (12): Turno
      // T (19): Valor Líquido

      const especialidadeAbrev = row[1]; // Coluna B
      const unidadeRaw = row[2]; // Coluna C
      const unidade = normalizarUnidade(unidadeRaw);
      const valorClinica = parseFloat(row[3]) || 0; // Coluna D - Valor Total Faturado
      const valorProfissional = parseFloat(row[4]) || 0; // Coluna E
      const valorFixo = parseFloat(row[5]) || 0; // Coluna F
      const metaMensal = row[6]; // Coluna G
      const faltas = parseInt(row[10]) || 0; // Coluna K
      const valorLiquido = parseFloat(row[19]) || 0; // Coluna T

      // Debug primeira linha
      if (i === 1) {
        console.log(`\n📋 DEBUG Primeira linha:`);
        console.log(`   A - Nome: ${funcionario}`);
        console.log(`   B - Especialidade: ${especialidadeAbrev}`);
        console.log(`   C - Unidade: ${unidadeRaw} -> ${unidade}`);
        console.log(`   D - Valor Faturado: ${row[3]} = ${valorClinica}`);
        console.log(`   E - Valor Profissional: ${row[4]} = ${valorProfissional}`);
        console.log(`   F - Valor Fixo: ${row[5]} = ${valorFixo}`);
        console.log(`   G - Meta: ${row[6]}`);
        console.log(`   K - Faltas: ${row[10]} = ${faltas}`);
        console.log(`   L - Email: ${email}`);
        console.log(`   M - Turno (coluna): ${row[12]} -> ${turno}`);
        console.log(`   T - Valor Líquido: ${row[19]} = ${valorLiquido}\n`);
      }

      let metaMensalValue = null;
      if (metaMensal && metaMensal !== 'N/P' && metaMensal !== 'NP' && !isNaN(parseFloat(metaMensal))) {
        metaMensalValue = parseFloat(metaMensal);
      }

      const { normalizarEspecialidade } = require('../utils/especialidades');
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
        valor_clinica: valorClinica,
        valor_profissional: valorProfissional,
        valor_fixo: valorFixo,
        faltas: faltas
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

        const vinculosNovos = prestador.vinculos.filter(v =>
          !vinculosExistentes.some(ve =>
            ve.turno === v.turno &&
            ve.especialidade === v.especialidade &&
            ve.unidade === v.unidade
          )
        );

        existentes.push({
          ...prestador,
          usuario_id: usuarioExistente.id,
          vinculos_existentes: vinculosExistentes,
          vinculos_novos: vinculosNovos
        });
      } else {
        novos.push(prestador);
      }
    }

    // Salvar informações temporárias para o próximo passo
    const tempData = {
      mes: parseInt(mes),
      ano: parseInt(ano),
      tipo_colaborador,
      periodo,
      filename: req.file.filename,
      filepath: req.file.path,
      prestadores: Array.from(prestadoresMap.values())
    };

    // Armazenar em arquivo temporário
    const tempFile = path.join(__dirname, '../uploads/temp', `temp-${Date.now()}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(tempData));

    console.log(`✅ Processamento concluído: ${novos.length} novos, ${existentes.length} existentes`);

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
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/upload/deletar/:mes/:ano/:tipo?
 * Deleta todos os dados de um mês específico
 * Se tipo for especificado ('prestador' ou 'clt'), deleta apenas esse tipo
 */
router.delete('/deletar/:mes/:ano/:tipo?', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { mes, ano, tipo } = req.params;
    const mesInt = parseInt(mes);
    const anoInt = parseInt(ano);

    // Validar tipo se fornecido
    if (tipo && !['prestador', 'clt'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido. Use "prestador" ou "clt"' });
    }

    console.log(`\n🗑️ DELETANDO DADOS: ${mes}/${ano}${tipo ? ` - ${tipo.toUpperCase()}` : ' - TODOS'}`);

    // Construir query base
    let query = db('dados_mensais')
      .where({ mes: mesInt, ano: anoInt });

    // Adicionar filtro de tipo se especificado
    if (tipo) {
      query = query.where('tipo_colaborador', tipo);
    }

    // Buscar todos os dados mensais do período
    const dadosMensais = await query.select('id', 'prestador_id', 'vinculo_id');

    if (dadosMensais.length === 0) {
      return res.json({
        message: `Nenhum dado encontrado para este período${tipo ? ` (${tipo})` : ''}`,
        deletados: 0
      });
    }

    const vinculosIds = dadosMensais.map(d => d.vinculo_id).filter(Boolean);
    const prestadorIds = [...new Set(dadosMensais.map(d => d.prestador_id))];

    // Deletar dados mensais
    let deleteQuery = db('dados_mensais')
      .where({ mes: mesInt, ano: anoInt });

    if (tipo) {
      deleteQuery = deleteQuery.where('tipo_colaborador', tipo);
    }

    await deleteQuery.del();
    console.log(`✅ ${dadosMensais.length} registros deletados de dados_mensais`);

    // Deletar vínculos órfãos (que não têm mais dados mensais)
    if (vinculosIds.length > 0) {
      const vinculosComDados = await db('dados_mensais')
        .whereIn('vinculo_id', vinculosIds)
        .distinct('vinculo_id')
        .pluck('vinculo_id');

      const vinculosOrfaos = vinculosIds.filter(id => !vinculosComDados.includes(id));

      if (vinculosOrfaos.length > 0) {
        await db('prestador_vinculos')
          .whereIn('id', vinculosOrfaos)
          .del();
        console.log(`✅ ${vinculosOrfaos.length} vínculos órfãos deletados`);
      }
    }

    // Deletar prestadores que foram criados neste mês e não têm outros dados
    let prestadoresDeletados = 0;
    for (const prestadorId of prestadorIds) {
      const temOutrosDados = await db('dados_mensais')
        .where('prestador_id', prestadorId)
        .count('* as total')
        .first();

      if (parseInt(temOutrosDados.total) === 0) {
        // Verificar se é um prestador novo (sem cadastro confirmado)
        const usuario = await db('usuarios')
          .where({ id: prestadorId, tipo: 'prestador', cadastro_confirmado: false })
          .first();

        if (usuario) {
          await db('usuarios').where('id', prestadorId).del();
          prestadoresDeletados++;
        }
      }
    }

    if (prestadoresDeletados > 0) {
      console.log(`✅ ${prestadoresDeletados} prestadores não confirmados deletados`);
    }

    res.json({
      message: 'Dados deletados com sucesso',
      deletados: dadosMensais.length,
      prestadores_removidos: prestadoresDeletados
    });

  } catch (error) {
    console.error('❌ Erro ao deletar dados:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/upload/confirmar
 * Confirma e salva os dados processados
 * Aceita parâmetro 'sobres crever' para atualizar dados existentes
 */
router.post('/confirmar', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { sobreescrever = false } = req.body;

    const { tempFile } = req.body;

    if (!tempFile) {
      return res.status(400).json({ error: 'Arquivo temporário não informado' });
    }

    const tempPath = path.join(__dirname, '../uploads/temp', tempFile);
    if (!fs.existsSync(tempPath)) {
      return res.status(400).json({ error: 'Arquivo temporário não encontrado' });
    }

    const tempData = JSON.parse(fs.readFileSync(tempPath, 'utf8'));
    const { mes, ano, tipo_colaborador, periodo, prestadores, filepath } = tempData;

    console.log(`\n💾 SALVANDO DADOS: ${mes}/${ano} - ${tipo_colaborador?.toUpperCase() || 'PRESTADOR'}`);
    console.log(`📅 Período: ${periodo?.inicio || 1} a ${periodo?.fim || 31}`);

    let novosUsuarios = 0;
    let novosVinculos = 0;
    let dadosMensaisSalvos = 0;

    for (const prestador of prestadores) {
      const { email, nome, vinculos } = prestador;

      // Verificar se email já existe (qualquer tipo)
      let usuario = await db('usuarios')
        .where({ email })
        .first();

      // Se o usuário é admin ou master, pular
      if (usuario && (usuario.tipo === 'admin' || usuario.tipo === 'master')) {
        console.log(`⚠️  Pulando ${email} - usuário ${usuario.tipo}`);
        continue;
      }

      if (!usuario) {
        const senhaHash = bcrypt.hashSync('123456', 10);
        const tokenConfirmacao = crypto.randomBytes(32).toString('hex');

        // Coletar todas as especialidades e unidades únicas
        const especialidades = [...new Set(vinculos.map(v => v.especialidade).filter(Boolean))];
        const unidades = [...new Set(vinculos.map(v => v.unidade).filter(Boolean))];

        const [userId] = await db('usuarios').insert({
          email,
          senha: senhaHash,
          nome,
          tipo: 'prestador',
          status: 'pendente',
          cadastro_confirmado: false,
          token_confirmacao: tokenConfirmacao,
          especialidade: especialidades[0] || null, // Primeira especialidade
          unidades: JSON.stringify(unidades), // Array de unidades
          meta_mensal: vinculos[0]?.meta_mensal || null
        }).returning('id');

        usuario = { id: userId.id || userId };
        novosUsuarios++;
      } else {
        // Atualizar especialidade e unidades do usuário existente
        const especialidades = [...new Set(vinculos.map(v => v.especialidade).filter(Boolean))];
        const unidades = [...new Set(vinculos.map(v => v.unidade).filter(Boolean))];

        // Buscar unidades existentes
        const unidadesExistentes = JSON.parse(usuario.unidades || '[]');
        const todasUnidades = [...new Set([...unidadesExistentes, ...unidades])];

        await db('usuarios')
          .where('id', usuario.id)
          .update({
            especialidade: especialidades[0] || usuario.especialidade,
            unidades: JSON.stringify(todasUnidades)
          });
      }

      for (const vinculo of vinculos) {
        const { turno, especialidade, unidade, meta_mensal, valor_liquido, valor_clinica, valor_profissional, valor_fixo, faltas } = vinculo;

        // Verificar se vínculo já existe (INCLUINDO tipo_contrato)
        const vinculoExistente = await db('prestador_vinculos')
          .where({
            prestador_id: usuario.id,
            tipo_contrato: tipo_colaborador || 'prestador',
            turno,
            especialidade,
            unidade
          })
          .first();

        let vinculoId;
        if (!vinculoExistente) {
          const [newVinculoId] = await db('prestador_vinculos').insert({
            prestador_id: usuario.id,
            tipo_contrato: tipo_colaborador || 'prestador',
            turno,
            especialidade,
            unidade,
            meta_mensal,
            ativo: true
          }).returning('id');

          vinculoId = newVinculoId.id || newVinculoId;
          novosVinculos++;
        } else {
          vinculoId = vinculoExistente.id;
        }

        // Verificar se já existe registro
        const dadoExistente = await db('dados_mensais')
          .where({
            vinculo_id: vinculoId,
            mes,
            ano
          })
          .first();

        const dadosParaSalvar = {
          prestador_id: usuario.id,
          vinculo_id: vinculoId,
          mes,
          ano,
          tipo_colaborador: tipo_colaborador || 'prestador',
          dia_inicio: periodo?.inicio || 1,
          dia_fim: periodo?.fim || null,
          valor_liquido,
          valor_clinica,
          valor_profissional,
          valor_fixo,
          faltas: faltas || 0,
          meta_batida: meta_mensal ? (valor_clinica >= meta_mensal) : false
        };

        if (dadoExistente && sobreescrever) {
          // Atualizar registro existente
          await db('dados_mensais')
            .where('id', dadoExistente.id)
            .update(dadosParaSalvar);
          console.log(`🔄 Atualizado: ${nome} - ${turno}`);
        } else if (!dadoExistente) {
          // Inserir novo registro
          await db('dados_mensais').insert(dadosParaSalvar);
        } else {
          // Registro já existe e não está em modo sobreescrever
          console.log(`⏭️  Pulado (já existe): ${nome} - ${turno}`);
          continue;
        }

        dadosMensaisSalvos++;
      }
    }

    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);

    console.log(`✅ Upload concluído: ${novosUsuarios} usuários, ${novosVinculos} vínculos, ${dadosMensaisSalvos} dados`);

    res.json({
      success: true,
      message: 'Upload concluído com sucesso!',
      total: dadosMensaisSalvos,
      sucessos: dadosMensaisSalvos,
      erros: 0,
      novos_usuarios: novosUsuarios,
      novos_vinculos: novosVinculos
    });

  } catch (error) {
    console.error('❌ Erro ao confirmar upload:', error);
    res.status(500).json({ error: error.message });
  }
});

// Backup dos dados existentes
const fazerBackup = async (mes, ano) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupTable = `backup_dados_mensais_${mes}_${ano}_${timestamp}`;

    // Criar tabela de backup
    // Knex doesn't have a direct "CREATE TABLE AS SELECT" method that is cross-db compatible easily
    // So we'll use raw query for this specific operation as it's efficient
    await db.raw(`CREATE TABLE ${backupTable} AS SELECT * FROM dados_mensais WHERE mes = ? AND ano = ?`, [parseInt(mes), parseInt(ano)]);

    console.log(`💾 Backup criado: ${backupTable}`);
    return backupTable;
  } catch (error) {
    console.error('❌ Erro ao criar backup:', error);
    throw error;
  }
};

// Upload e processamento de planilha
router.post('/planilha', authenticateToken, requireAdmin, upload.single('planilha'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const { mes, ano, sobrescrever = 'false' } = req.body;
    if (!mes || !ano) {
      return res.status(400).json({ error: 'Mês e ano são obrigatórios' });
    }

    console.log('📊 Processando planilha:', req.file.originalname);
    console.log('📅 Mês/Ano:', mes, ano);
    console.log('🔄 Sobrescrever:', sobrescrever);

    // Verificar se já existem dados
    const dadosExistentes = await db('dados_mensais')
      .where({ mes: parseInt(mes), ano: parseInt(ano) })
      .count('* as total')
      .first();

    let backupTable = null;
    const totalExistente = parseInt(dadosExistentes.total);

    if (totalExistente > 0 && sobrescrever === 'true') {
      console.log('⚠️ Dados existentes encontrados, criando backup...');
      backupTable = await fazerBackup(mes, ano);

      // Remover dados existentes
      await db('dados_mensais')
        .where({ mes: parseInt(mes), ano: parseInt(ano) })
        .del();

      console.log(`🗑️ Dados existentes removidos (${totalExistente} registros)`);
    } else if (totalExistente > 0 && sobrescrever !== 'true') {
      // Remover arquivo temporário
      fs.unlinkSync(req.file.path);

      return res.status(409).json({
        error: 'Já existem dados para este mês/ano',
        dados_existentes: {
          total: totalExistente,
          mes: parseInt(mes),
          ano: parseInt(ano)
        }
      });
    }

    // Ler a planilha
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = MESES_ABAS[parseInt(mes)];

    if (!sheetName) {
      return res.status(400).json({ error: `Mês inválido: ${mes}` });
    }

    console.log(`🔍 Procurando aba: "${sheetName}"`);
    console.log(`📑 Abas disponíveis: ${workbook.SheetNames.join(', ')}`);

    // Tentar encontrar a aba (case-insensitive)
    let worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      // Tentar busca case-insensitive
      const sheetNameLower = sheetName.toLowerCase();
      const foundSheet = workbook.SheetNames.find(name => name.toLowerCase() === sheetNameLower);

      if (foundSheet) {
        console.log(`✅ Aba encontrada com nome diferente: "${foundSheet}"`);
        worksheet = workbook.Sheets[foundSheet];
      }
    }

    if (!worksheet) {
      // Listar abas disponíveis para ajudar no debug
      const abasDisponiveis = workbook.SheetNames.join(', ');
      return res.status(400).json({
        error: `Aba '${sheetName}' não encontrada na planilha`,
        aba_esperada: sheetName,
        abas_disponiveis: abasDisponiveis,
        dica: `Certifique-se de que a planilha possui uma aba chamada '${sheetName}' (maiúsculas/minúsculas não importam)`
      });
    }

    // Converter para JSON
    const dados = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log('📋 Total de linhas na planilha:', dados.length);

    // Processar dados - APENAS LINHAS 1 a 44 (índices 1 a 44)
    const prestadores = [];
    const MAX_LINHA = Math.min(45, dados.length); // Linhas 1-44 (índice 1-44, pois 0 é cabeçalho)

    console.log(`📋 Processando linhas 1 a ${MAX_LINHA - 1}...`);

    for (let linha = 1; linha < MAX_LINHA; linha++) {
      const row = dados[linha];
      if (row && row.length > 0) {
        const funcionario = row[0]; // Coluna A - NOME DO FUNCIONÁRIO
        const especialidadeAbrev = row[1]; // Coluna B - ESPECIALIDADE (Acup, Fisio, etc)
        const unidade = row[2]; // Coluna C - UNIDADE (ANEXO, MATRIZ, etc)
        const valorClinica = row[3]; // Coluna D - VALOR TOTAL CLÍNICA (faturamento bruto)
        const valorPorPlantao = row[4]; // Coluna E - VALOR POR PLANTÃO
        const valorFixo = row[5]; // Coluna F - FIXO (S/N ou boolean)
        const metaMensal = row[6]; // Coluna G - META MENSAL
        const faltas = row[10] || 0; // Coluna K - FALTAS
        const email = row[11]; // Coluna L - EMAIL
        const valorLiquido = row[19] || 0; // Coluna T - Valor Líquido

        // Debug: mostrar valores das primeiras colunas
        if (funcionario) {
          console.log(`📋 Linha ${linha}:`, {
            'A-Nome': row[0],
            'B-Especialidade': row[1],
            'C-Unidade': row[2],
            'D-ValorClinica': row[3],
            'E-ValorPlantao': row[4],
            'F-Fixo': row[5],
            'G-Meta': row[6],
            'K-Faltas': row[10],
            'L-Email': row[11],
            'T-ValorLiquido': row[19]
          });
        }

        // Validar email
        if (funcionario && email && email !== 'NP' && email.includes('@')) {
          // Processar meta mensal
          let metaMensalValue = null;
          if (metaMensal && metaMensal !== 'N/P' && metaMensal !== 'NP' && !isNaN(parseFloat(metaMensal))) {
            metaMensalValue = parseFloat(metaMensal);
          }

          prestadores.push({
            nome: funcionario,
            email: email.trim().toLowerCase(), // Normalizar email
            especialidade: especialidadeAbrev,
            unidade: unidade,
            valor_fixo: valorFixo === 'S' || valorFixo === 's' || valorFixo === true || valorFixo === 'Sim',
            meta_mensal: metaMensalValue,
            faltas: parseFloat(faltas) || 0,
            valor_liquido: parseFloat(valorLiquido) || 0,
            valor_clinica: parseFloat(valorClinica) || 0
          });
        }
      }
    }

    console.log('👥 Prestadores encontrados:', prestadores.length);

    // Salvar dados no banco
    let sucessos = 0;
    let erros = 0;

    for (const prestador of prestadores) {
      try {
        console.log(`💾 Salvando prestador: ${prestador.nome} (${prestador.email})`);

        // Verificar se o prestador já existe
        let user = await db('usuarios').where({ email: prestador.email }).first();

        if (user) {
          console.log(`✅ Prestador existente encontrado: ${user.id}`);

          // Buscar meta do prestador (do contrato ou padrão)
          const metaMensal = user.meta_mensal || 5000;
          const metaBatida = prestador.valor_liquido >= metaMensal ? 1 : 0;

          // Atualizar dados mensais
          await db('dados_mensais')
            .insert({
              prestador_id: user.id,
              mes: parseInt(mes),
              ano: parseInt(ano),
              valor_liquido: parseFloat(prestador.valor_liquido) || 0,
              valor_clinica: parseFloat(prestador.valor_clinica) || 0,
              faltas: parseInt(prestador.faltas) || 0,
              meta_batida: metaBatida
            })
            .onConflict(['prestador_id', 'mes', 'ano'])
            .merge();

          sucessos++;
          console.log(`✅ Dados mensais atualizados para: ${prestador.nome} (Meta: R$ ${metaMensal})`);
        } else {
          console.log(`🆕 Criando pré-cadastro para: ${prestador.nome} (${prestador.email})`);

          // Mapear especialidade e normalizar unidade
          const { normalizarEspecialidade, determinarUnidades } = require('../utils/especialidades');

          let unidades = [];
          const especialidadeNormalizada = normalizarEspecialidade(prestador.especialidade);

          // Normalizar unidade da planilha
          const unidadeNormalizada = normalizarUnidade(prestador.unidade);

          if (unidadeNormalizada && unidadeNormalizada !== 'NP') {
            // Usar unidade da planilha (já normalizada)
            unidades = [unidadeNormalizada];
            console.log(`   📍 Unidade: ${unidadeNormalizada} (original: ${prestador.unidade})`);
          } else {
            // Determinar por especialidade
            unidades = determinarUnidades(especialidadeNormalizada);
            console.log(`   📍 Unidade(s) determinada(s) por especialidade: ${unidades.join(', ')}`);
          }

          // Meta mensal - não usar valor padrão se for N/P
          let metaMensal = null;
          if (prestador.meta_mensal && prestador.meta_mensal !== 'N/P' && prestador.meta_mensal !== 'NP' && !isNaN(parseFloat(prestador.meta_mensal))) {
            metaMensal = parseFloat(prestador.meta_mensal);
          }

          // Gerar token de confirmação
          const tokenConfirmacao = crypto.randomBytes(32).toString('hex');
          const senhaHash = bcrypt.hashSync('123456', 10); // Senha padrão

          // #region agent log
          try {
            // Hypotheses H1/H2: usuarios schema vs insert columns (cadastro_confirmado)
            const insertPayload = {
              email: prestador.email,
              nome: prestador.nome,
              tipo: 'prestador',
              status: 'pendente',
              cadastro_confirmado: false,
              especialidade: especialidadeNormalizada,
              unidades: JSON.stringify(unidades),
              valor_fixo: prestador.valor_fixo,
              meta_mensal: metaMensal
            };
            fetch('http://127.0.0.1:7245/ingest/c587a5fd-0753-44cb-be2b-c15533efa8d7', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: 'debug-session',
                runId: 'initial',
                hypothesisId: 'H2',
                location: 'backend/routes/upload.js:310',
                message: 'About to insert new prestador with usuarios columns',
                data: { insertKeys: Object.keys(insertPayload) },
                timestamp: Date.now()
              })
            }).catch(() => { });
          } catch (_) {
            // Ignore logging failures
          }
          // #endregion

          const [newUserId] = await db('usuarios').insert({
            email: prestador.email,
            senha: senhaHash,
            nome: prestador.nome,
            tipo: 'prestador',
            status: 'pendente', // Status pendente até primeiro login
            cadastro_confirmado: false,
            token_confirmacao: tokenConfirmacao,
            especialidade: especialidadeNormalizada,
            unidades: JSON.stringify(unidades),
            valor_fixo: prestador.valor_fixo,
            meta_mensal: metaMensal
          }).returning('id');

          // For SQLite compatibility - extract ID correctly
          let userId;
          if (Array.isArray(newUserId) && newUserId.length > 0) {
            userId = newUserId[0];
          } else if (typeof newUserId === 'object' && newUserId !== null && newUserId.id) {
            userId = newUserId.id;
          } else if (typeof newUserId === 'number') {
            userId = newUserId;
          } else {
            const user = await db('usuarios').where({ email: prestador.email }).first();
            userId = user.id;
          }

          console.log(`✅ Pré-cadastro criado com ID: ${userId}`);
          console.log(`   📍 Especialidade: ${especialidadeNormalizada}`);
          console.log(`    Unidade(s): ${unidades.join(', ')}`);
          console.log(`   📍 Valor Fixo: ${prestador.valor_fixo ? 'Sim' : 'Não'}`);
          console.log(`   📍 Meta Mensal: ${metaMensal ? `R$ ${metaMensal.toFixed(2)}` : 'Não possui'}`);
          console.log(`   📍 Status: pendente`);

          // Inserir dados mensais (mesmo com status pendente)
          await db('dados_mensais').insert({
            prestador_id: userId,
            mes: parseInt(mes),
            ano: parseInt(ano),
            valor_liquido: parseFloat(prestador.valor_liquido) || 0,
            valor_clinica: parseFloat(prestador.valor_clinica) || 0, // Adicionado valor_clinica
            faltas: parseInt(prestador.faltas) || 0,
            meta_batida: prestador.valor_liquido >= metaMensal ? 1 : 0
          });

          sucessos++;
          console.log(`✅ Dados mensais inseridos para pré-cadastro: ${prestador.nome}`);
          console.log(`⚠️  Prestador ficará PENDENTE até completar cadastro e fazer primeiro login`);
        }
      } catch (error) {
        console.error(`❌ Erro ao salvar prestador ${prestador.nome}:`, error);

        // #region agent log
        try {
          fetch('http://127.0.0.1:7245/ingest/c587a5fd-0753-44cb-be2b-c15533efa8d7', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: 'debug-session',
              runId: 'initial',
              hypothesisId: 'H1',
              location: 'backend/routes/upload.js:348',
              message: 'Erro ao salvar prestador na tabela usuarios',
              data: {
                nome: prestador.nome,
                email: prestador.email,
                code: error.code || null,
                errno: error.errno || null,
                message: error.message || null
              },
              timestamp: Date.now()
            })
          }).catch(() => { });
        } catch (_) {
          // Ignore logging failures
        }
        // #endregion

        erros++;
      }
    }

    console.log(`📊 Resultado final: ${sucessos} sucessos, ${erros} erros`);

    // Remover arquivo temporário
    fs.unlinkSync(req.file.path);

    // Enviar notificação via WebSocket
    const io = req.app.get('io');
    if (io) {
      const NotificationService = require('../services/notifications');
      const notificationService = new NotificationService(io);

      notificationService.notifyPlanilhaProcessada({
        total: prestadores.length,
        sucessos,
        erros,
        mes,
        ano,
        prestadores: prestadores.slice(0, 5),
        sobrescreveu: sobrescrever === 'true',
        backup_table: backupTable
      });
    }

    // Enviar email de confirmação
    const emailService = require('../services/emailService');
    if (emailService.isConfigurado()) {
      try {
        await emailService.enviarConfirmacaoUpload(req.user.email, {
          total: prestadores.length,
          sucessos,
          erros,
          mes,
          ano,
          sobrescreveu: sobrescrever === 'true',
          backup_table: backupTable
        });
      } catch (error) {
        console.error('❌ Erro ao enviar email de confirmação:', error);
      }
    }

    res.json({
      message: sobrescrever === 'true' ? 'Planilha processada e dados sobrescritos com sucesso' : 'Planilha processada com sucesso',
      total: prestadores.length,
      sucessos,
      erros,
      prestadores: prestadores.slice(0, 5), // Mostrar apenas os primeiros 5
      sobrescreveu: sobrescrever === 'true',
      backup_table: backupTable
    });

  } catch (error) {
    console.error('❌ Erro ao processar planilha:', error);
    res.status(500).json({ error: 'Erro ao processar planilha: ' + error.message });
  }
});

// Listar arquivos enviados
router.get('/arquivos', authenticateToken, requireAdmin, (req, res) => {
  const uploadDir = path.join(__dirname, '../uploads');

  if (!fs.existsSync(uploadDir)) {
    return res.json({ arquivos: [] });
  }

  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao listar arquivos' });
    }

    const arquivos = files.map(file => ({
      nome: file,
      tamanho: fs.statSync(path.join(uploadDir, file)).size,
      data: fs.statSync(path.join(uploadDir, file)).mtime
    }));

    res.json({ arquivos });
  });
});

module.exports = router;