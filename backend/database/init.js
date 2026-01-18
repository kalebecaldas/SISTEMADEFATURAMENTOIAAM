const db = require('./connection');

const initDatabase = async () => {
  try {
    // PRIMEIRO: Garantir que o esquema básico existe
    console.log('🔧 Garantindo estrutura base do banco...');
    const { ensureSchema } = require('./ensure-schema');
    await ensureSchema();

    // Executar migrações adicionais
    const { adicionarTabelasContratos } = require('./migrations/contratos');
    await adicionarTabelasContratos();

    // Criar tabela de vínculos (CRÍTICO - deve vir antes das outras)
    const { up: criarTabelaVinculos } = require('./migrations/007_prestador_vinculos');
    const hasVinculos = await db.schema.hasTable('prestador_vinculos');
    if (!hasVinculos) {
      await criarTabelaVinculos();
    } else {
      console.log('ℹ️  Tabela prestador_vinculos já existe');
    }

    // Adicionar campos de confirmação (NOVO)
    const { adicionarCamposConfirmacao } = require('./migrations/confirmacao');
    await adicionarCamposConfirmacao();

    // Adicionar tabela de solicitações (NOVO)
    const { adicionarTabelasSolicitacoes } = require('./migrations/solicitacoes');
    await adicionarTabelasSolicitacoes();

    // Adicionar campos de status e confirmação (NOVO)
    const { adicionarCamposStatus } = require('./migrations/status_prestadores');
    await adicionarCamposStatus();

    // Criar tabela de dados mensais (ESSENCIAL)
    const { criarTabelaDadosMensais } = require('./migrations/dados_mensais');
    await criarTabelaDadosMensais();

    // Adicionar campos de edição de valores (NOVO)
    const { adicionarCamposEdicaoValores } = require('./migrations/edicao_valores');
    await adicionarCamposEdicaoValores();

    // Melhorar estrutura de prestadores (NOVO)
    const { melhorarEstruturaPrestadores } = require('./migrations/melhorar_prestadores');
    await melhorarEstruturaPrestadores();

    // Adicionar campos de comprovante de pagamento (NOVO)
    const { adicionarCamposComprovante } = require('./migrations/comprovantes');
    await adicionarCamposComprovante();

    // Adicionar campos de aprovação de notas fiscais (NOVO)
    const { adicionarCamposAprovacaoNotas } = require('./migrations/aprovacao_notas');
    await adicionarCamposAprovacaoNotas();

    // Adicionar tipo master e criar usuário master (NOVO)
    const { adicionarTipoMaster } = require('./migrations/master_user');
    await adicionarTipoMaster();

    // Adicionar tipo de colaborador e período de referência (NOVO)
    const { adicionarTipoColaborador } = require('./migrations/adicionar_tipo_colaborador');
    await adicionarTipoColaborador();

    // Adicionar tipo de contrato aos vínculos (NOVO)
    const { adicionarTipoContratoVinculos } = require('./migrations/adicionar_tipo_contrato_vinculos');
    await adicionarTipoContratoVinculos();

    // Garantir que admin existe (executado sempre)
    const bcrypt = require('bcryptjs');
    const adminEmail = 'kalebe.caldas@hotmail.com';
    const adminSenha = 'mxskqgltne';
    const adminNome = 'Kalebe Caldas';

    const existingAdmin = await db('usuarios').where({ email: adminEmail }).first();
    if (!existingAdmin) {
      const senhaHash = bcrypt.hashSync(adminSenha, 10);
      await db('usuarios').insert({
        email: adminEmail,
        senha: senhaHash,
        nome: adminNome,
        tipo: 'admin',
        ativo: true
      });
      console.log('✅ Admin customizado criado:', adminEmail);
    } else {
      console.log('ℹ️ Admin já existe:', adminEmail);
    }

    console.log('✅ Banco de dados inicializado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  }
};

module.exports = { db, initDatabase };