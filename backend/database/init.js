const db = require('./connection');

const initDatabase = async () => {
  try {
    // Tabela de usuários
    const hasUsuarios = await db.schema.hasTable('usuarios');
    if (!hasUsuarios) {
      await db.schema.createTable('usuarios', (table) => {
        table.increments('id').primary();
        table.string('email').unique().notNullable();
        table.string('senha').notNullable();
        table.string('nome').notNullable();
        table.string('tipo').defaultTo('prestador');
        table.boolean('ativo').defaultTo(true);
        table.timestamps(true, true); // created_at, updated_at
      });
      console.log('✅ Tabela usuarios criada');

      // Criar admin padrão
      const bcrypt = require('bcryptjs');
      const senhaHash = bcrypt.hashSync('admin123', 10);
      await db('usuarios').insert({
        email: 'admin@sistema.com',
        senha: senhaHash,
        nome: 'Administrador',
        tipo: 'admin'
      });
      console.log('✅ Admin padrão criado');
    }

    // Tabela de dados mensais
    const hasDadosMensais = await db.schema.hasTable('dados_mensais');
    if (!hasDadosMensais) {
      await db.schema.createTable('dados_mensais', (table) => {
        table.increments('id').primary();
        table.integer('prestador_id').references('id').inTable('usuarios').onDelete('CASCADE');
        table.integer('mes').notNullable();
        table.integer('ano').notNullable();
        table.decimal('valor_liquido', 10, 2).notNullable();
        table.integer('faltas').defaultTo(0);
        table.boolean('meta_batida').defaultTo(false);
        table.decimal('valor_bruto', 10, 2);
        table.string('especialidade');
        table.string('unidade');
        table.timestamps(true, true);
        table.unique(['prestador_id', 'mes', 'ano']);
      });
      console.log('✅ Tabela dados_mensais criada');
    }

    // Tabela de notas fiscais
    const hasNotas = await db.schema.hasTable('notas_fiscais');
    if (!hasNotas) {
      await db.schema.createTable('notas_fiscais', (table) => {
        table.increments('id').primary();
        table.integer('prestador_id').references('id').inTable('usuarios').onDelete('CASCADE');
        table.integer('mes').notNullable();
        table.integer('ano').notNullable();
        table.string('arquivo_path');
        table.string('status').defaultTo('pendente');
        table.datetime('data_envio');
        table.text('observacoes');
        table.timestamps(true, true);
      });
      console.log('✅ Tabela notas_fiscais criada');
    }

    // Tabela de configurações
    const hasConfig = await db.schema.hasTable('configuracoes');
    if (!hasConfig) {
      await db.schema.createTable('configuracoes', (table) => {
        table.increments('id').primary();
        table.string('chave').unique().notNullable();
        table.string('valor').notNullable();
        table.string('descricao');
        table.timestamps(true, true);
      });
      console.log('✅ Tabela configuracoes criada');

      // Configurações padrão
      const configs = [
        { chave: 'prazo_nota_fiscal', valor: '15', descricao: 'Prazo em dias para envio da nota fiscal' },
        { chave: 'meta_padrao', valor: '5000', descricao: 'Meta padrão em reais' },
        { chave: 'sistema_ativo', valor: '1', descricao: 'Status do sistema (1=ativo, 0=inativo)' }
      ];

      await db('configuracoes').insert(configs).onConflict('chave').ignore();
      console.log('✅ Configurações padrão inseridas');
    }

    // Executar migrações
    const { adicionarTabelasContratos } = require('./migrations/contratos');
    await adicionarTabelasContratos();

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