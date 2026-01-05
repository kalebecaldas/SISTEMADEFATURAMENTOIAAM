const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const socketIo = require('socket.io');
const compression = require('compression');
require('dotenv').config();

const { initDatabase } = require('./database/init');
const logger = require('./services/logger');
const { errorHandler, notFound, validateEnvironment } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const prestadorRoutes = require('./routes/prestadores');
const comprovantesRoutes = require('./routes/comprovantes');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const apiRoutes = require('./routes/api');
const contratosRoutes = require('./routes/contratos');
const documentosRoutes = require('./routes/documentos');
const invoicesRoutes = require('./routes/invoices');
const settingsRoutes = require('./routes/settings');
const confirmacaoRoutes = require('./routes/confirmacao');
const pagamentosRoutes = require('./routes/pagamentos');
const dadosMensaisRoutes = require('./routes/dados-mensais');
const relatoriosRoutes = require('./routes/relatorios');
const usersRoutes = require('./routes/users');

// Validar variáveis de ambiente
try {
  validateEnvironment();
} catch (error) {
  console.error('❌ Environment validation failed:', error.message);
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// Configurar origens permitidas
const allowedOrigins = [
  "http://localhost:3001",
  "http://localhost:3000",
  "http://localhost:5173",
  process.env.FRONTEND_URL
].filter(Boolean); // Remove undefined

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5001;

// Middleware de segurança e otimização
app.use(helmet());
app.use(compression()); // Compressão gzip
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Morgan com logger customizado
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.http(message.trim())
  }
}));

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info('WebSocket client connected', { socketId: socket.id });

  // Autenticar usuário via socket
  socket.on('authenticate', (token) => {
    try {
      const jwt = require('jsonwebtoken');
      const user = jwt.verify(token, process.env.JWT_SECRET);

      // Adicionar usuário à sala específica
      socket.join(`user_${user.id}`);
      socket.join(`type_${user.tipo}`);

      logger.auth('WebSocket authenticated', user.nome, {
        socketId: socket.id,
        userId: user.id,
        userType: user.tipo,
      });
    } catch (error) {
      logger.error('WebSocket authentication failed', error, {
        socketId: socket.id,
      });
    }
  });

  // Notificação de nova planilha processada
  socket.on('planilha_processada', (data) => {
    io.to('type_admin').emit('planilha_atualizada', data);
    logger.info('Spreadsheet processed notification sent', data);
  });

  // Notificação de nova nota fiscal
  socket.on('nota_fiscal_enviada', (data) => {
    io.to('type_admin').emit('nota_recebida', data);
    logger.info('Invoice sent notification', data);
  });

  socket.on('disconnect', () => {
    logger.info('WebSocket client disconnected', { socketId: socket.id });
  });
});

// Disponibilizar io para as rotas
app.set('io', io);

// Inicializar Scheduler
const schedulerService = require('./services/schedulerService');
schedulerService.init();

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/prestadores', prestadorRoutes);
app.use('/api/colaboradores', prestadorRoutes); // Alias para compatibilidade
app.use('/api/comprovantes', comprovantesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/contratos', contratosRoutes);
app.use('/api/documentos', documentosRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/confirmacao', confirmacaoRoutes);
app.use('/api/pagamentos', pagamentosRoutes);
app.use('/api/dados-mensais', dadosMensaisRoutes);
app.use('/api/relatorios', relatoriosRoutes);
app.use('/api/users', usersRoutes);
app.use('/api', apiRoutes);

// Rota de teste
app.get('/', (req, res) => {
  res.json({
    message: 'Sistema de Faturamento API',
    version: '1.0.0',
    status: 'running',
    websockets: 'enabled',
    features: {
      email: require('./services/emailService').isConfigurado(),
      logging: true,
      compression: true,
    }
  });
});

// Rota para testar conexão de email
app.get('/api/test-email', async (req, res) => {
  const emailService = require('./services/emailService');
  const result = await emailService.testarConexao();
  res.json(result);
});

// Rota temporária para criar admin (REMOVER EM PRODUÇÃO)
app.get('/api/create-admin-now', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { db } = require('./database/init');

    const adminEmail = 'kalebe.caldas@hotmail.com';
    const adminSenha = 'mxskqgltne';
    const adminNome = 'Kalebe Caldas';

    const existingAdmin = await db('usuarios').where({ email: adminEmail }).first();

    if (existingAdmin) {
      return res.json({
        success: true,
        message: 'Admin já existe!',
        email: adminEmail
      });
    }

    const senhaHash = bcrypt.hashSync(adminSenha, 10);
    await db('usuarios').insert({
      email: adminEmail,
      senha: senhaHash,
      nome: adminNome,
      tipo: 'admin',
      ativo: true
    });

    res.json({
      success: true,
      message: 'Admin criado com sucesso!',
      email: adminEmail
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Middleware para rotas não encontradas (deve vir antes do error handler)
app.use(notFound);

// Middleware de erro (deve ser o último)
app.use(errorHandler);

// Inicializar banco de dados e iniciar servidor
initDatabase().then(() => {
  server.listen(PORT, () => {
    logger.info('Server started successfully', {
      port: PORT,
      environment: process.env.NODE_ENV,
      features: {
        email: require('./services/emailService').isConfigurado(),
        websockets: true,
        compression: true,
        logging: true,
      }
    });
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 API disponível em: http://localhost:${PORT}`);
    console.log(`🔌 WebSockets habilitados`);
    console.log(`🔐 Admin padrão: admin@sistema.com / admin123`);

    // Testar conexão de email (aguardar carregamento das configurações)
    const emailService = require('./services/emailService');
    // Aguardar um pouco para garantir que as configurações foram carregadas
    setTimeout(async () => {
      // Recarregar configurações para garantir que estão atualizadas
      await emailService.loadConfig();

      if (emailService.isConfigurado()) {
        emailService.testarConexao().then(result => {
          if (result.success) {
            logger.info('Email service ready');
            console.log('📧 Serviço de email configurado e funcionando');
          } else {
            logger.warn('Email service connection failed', { error: result.error });
            console.log('⚠️  Serviço de email configurado mas com problemas de conexão');
          }
        });
      } else {
        logger.warn('Email service not configured');
        console.log('⚠️  Serviço de email não configurado');
      }
    }, 1000);
  });
}).catch(err => {
  logger.error('Failed to initialize database', err);
  console.error('❌ Erro ao inicializar banco de dados:', err);
  process.exit(1);
}); 