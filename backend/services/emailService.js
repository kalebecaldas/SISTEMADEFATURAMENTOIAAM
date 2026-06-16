const nodemailer = require('nodemailer');
const logger = require('./logger');
const { db } = require('../database/init');
const { getFrontendURL } = require('../utils/networkUtils');

class EmailService {
  constructor() {
    this.configurado = false;
    this.transporter = null;
    this.empresaNome = process.env.EMPRESA_NOME || 'ZoraH';
    this.emailConfig = {
      host: null,
      port: null,
      user: null,
      pass: null,
      secure: null,
      service: null
    };

    // Inicializar configurações (assíncrono, mas não bloqueia)
    this.loadConfig().catch(err => {
      logger.error('Failed to load email config on init', err);
    });
  }

  // Carregar configurações do banco de dados ou .env
  async loadConfig() {
    try {
      // Tentar carregar do banco de dados primeiro
      const configs = await db('configuracoes')
        .whereIn('chave', ['email_host', 'email_port', 'email_user', 'email_pass', 'email_secure', 'email_service', 'frontend_url'])
        .select('chave', 'valor');

      const configMap = {};
      configs.forEach(c => {
        configMap[c.chave] = c.valor;
      });

      // Usar configurações do banco se disponíveis, senão usar .env
      const emailHost = configMap.email_host || process.env.EMAIL_HOST;
      const emailPort = configMap.email_port ? parseInt(configMap.email_port) : (process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : null);
      const emailUser = configMap.email_user || process.env.EMAIL_USER;
      const emailPass = configMap.email_pass || process.env.EMAIL_PASS;
      const emailSecure = configMap.email_secure === 'true' || configMap.email_secure === '1' || process.env.EMAIL_SECURE === 'true';
      const emailService = configMap.email_service || process.env.EMAIL_SERVICE || 'gmail';
      const frontendURL = configMap.frontend_url || process.env.FRONTEND_URL;

      // Salvar configurações carregadas
      this.emailConfig = {
        host: emailHost,
        port: emailPort,
        user: emailUser,
        pass: emailPass,
        secure: emailSecure,
        service: emailService,
        frontend_url: frontendURL
      };

      // Configurar transporter se tiver user e pass
      if (emailUser && emailPass) {
        const transporterConfig = {
          auth: {
            user: emailUser,
            pass: emailPass
          },
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
        };

        // Se usar service (gmail, outlook, etc), usar service
        // Senão, usar host e port
        if (emailService && emailService !== 'custom') {
          transporterConfig.service = emailService;
        } else if (emailHost && emailPort) {
          transporterConfig.host = emailHost;
          transporterConfig.port = emailPort;
          transporterConfig.secure = emailSecure;
        }

        this.transporter = nodemailer.createTransport(transporterConfig);
        this.configurado = true;
        logger.info('Email service configured', {
          user: emailUser,
          source: configMap.email_user ? 'database' : 'env'
        });
      } else {
        this.configurado = false;
        this.transporter = null;
        logger.warn('Email service not configured - missing credentials', {
          hasUser: !!emailUser,
          hasPass: !!emailPass,
        });
      }
    } catch (error) {
      logger.error('Error loading email config', error);
      // Fallback para .env se houver erro ao ler do banco
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          },
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
        });
        this.configurado = true;
        logger.info('Email service configured from env (fallback)', {
          user: process.env.EMAIL_USER,
        });
      }
    }
  }

  // Recarregar configurações (chamado quando settings são atualizadas)
  async reloadConfig() {
    await this.loadConfig();
  }

  // Testar conexão SMTP
  async testarConexao() {
    if (!this.configurado) {
      return {
        success: false,
        message: 'Email não configurado',
      };
    }

    try {
      await this.transporter.verify();
      logger.info('SMTP connection test successful');
      return {
        success: true,
        message: 'Conexão SMTP estabelecida com sucesso',
      };
    } catch (error) {
      logger.error('SMTP connection test failed', error);
      return {
        success: false,
        message: 'Falha na conexão SMTP',
        error: error.message,
      };
    }
  }
  /**
   * Enviar email de confirmação de cadastro para prestador
   */
  async enviarEmailConfirmacaoCadastro(email, nome, token) {
    // Usar URL do banco de dados, env, ou detectar automaticamente
    const frontendURL = this.emailConfig.frontend_url || process.env.FRONTEND_URL || getFrontendURL();
    const link = `${frontendURL}/confirmar-cadastro?token=${token}`;

    logger.info('Registration confirmation link generated', {
      frontendURL,
      email,
      usingAutoDetect: !this.emailConfig.frontend_url && !process.env.FRONTEND_URL
    });

    const mailOptions = {
      from: this.emailConfig.user || process.env.EMAIL_USER,
      to: email,
      subject: `🔐 Confirme seu cadastro no ${this.empresaNome}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, rgba(0,102,255,0.05) 0%, rgba(0,212,255,0.05) 100%); padding: 20px; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="
              width: 60px;
              height: 60px;
              margin: 0 auto 10px;
              background: linear-gradient(135deg, #0066FF 0%, #00D4FF 100%);
              border-radius: 15px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 2rem;
              font-weight: bold;
              color: white;
              box-shadow: 0 4px 20px rgba(0, 102, 255, 0.3);
            ">Z</div>
            <h1 style="
              background: linear-gradient(135deg, #0066FF 0%, #00D4FF 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
              font-size: 2rem;
              margin: 0;
            ">${this.empresaNome}</h1>
          </div>

          <h2 style="color: #1976d2; text-align: center;">Bem-vindo, ${nome}!</h2>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <p>Seu cadastro foi criado com sucesso.</p>
            <p>Para ativar sua conta e definir sua senha, clique no botão abaixo:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${link}" style="
                background: linear-gradient(135deg, #0066FF 0%, #00D4FF 100%);
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 25px;
                font-weight: bold;
                display: inline-block;
                box-shadow: 0 4px 15px rgba(0, 102, 255, 0.3);
              ">Confirmar Cadastro</a>
            </div>
            
            <p style="font-size: 12px; color: #666;">
              Ou copie e cole este link no seu navegador:<br>
              ${link}
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #666; font-size: 12px; text-align: center;">
            Este é um email automático do <strong>${this.empresaNome}</strong>.
          </p>
        </div>
      `
    };

    try {
      if (!this.configurado) {
        logger.warn('Email not configured - simulating send', {
          type: 'confirmacao_cadastro',
          recipient: email,
          link
        });
        return true;
      }
      await this.transporter.sendMail(mailOptions);
      logger.email('Registration confirmation sent', email);
      return true;
    } catch (error) {
      logger.error('Failed to send registration confirmation email', error, { recipient: email });
      return false;
    }
  }

  // Alias para manter consistência com as rotas
  async enviarEmailConfirmacao(email, nome, token) {
    return this.enviarEmailConfirmacaoCadastro(email, nome, token);
  }

  /**
   * Enviar comprovante de pagamento para colaborador
   */
  async enviarComprovantePagamento(email, dados, comprovanteAnexo = null) {
    const { nome, mes, ano, valor_liquido, faltas, meta_batida, meta_mensal, especialidade, valor_editado, status, tipo_colaborador, informacoes_importantes } = dados;

    const mesesNomes = {
      1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril',
      5: 'Maio', 6: 'Junho', 7: 'Julho', 8: 'Agosto',
      9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro'
    };

    const mesNome = mesesNomes[mes];
    const temMeta = meta_mensal != null && meta_mensal > 0;
    const metaFormatada = temMeta ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(meta_mensal) : null;
    const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor_liquido);
    const percentualMeta = temMeta ? ((valor_liquido / meta_mensal) * 100).toFixed(1) : null;

    // Verificar se o colaborador está ativo
    const isAtivo = status === 'ativo';
    // Verificar se é prestador de serviço (precisa enviar NF)
    const isPrestadorServico = tipo_colaborador === 'prestador_servico';

    const mailOptions = {
      from: this.emailConfig.user || process.env.EMAIL_USER,
      to: email,
      subject: `💰 Valor a Receber - ${mesNome}/${ano}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, rgba(0,102,255,0.05) 0%, rgba(0,212,255,0.05) 100%); padding: 20px; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="
              width: 60px;
              height: 60px;
              margin: 0 auto 10px;
              background: linear-gradient(135deg, #0066FF 0%, #00D4FF 100%);
              border-radius: 15px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 2rem;
              font-weight: bold;
              color: white;
              box-shadow: 0 4px 20px rgba(0, 102, 255, 0.3);
            ">Z</div>
            <h1 style="
              background: linear-gradient(135deg, #0066FF 0%, #00D4FF 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
              font-size: 2rem;
              margin: 0;
            ">${this.empresaNome}</h1>
          </div>

          <h2 style="color: #1976d2; text-align: center;">💰 Valor a Receber</h2>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <h3 style="margin-top: 0;">Olá, ${nome}!</h3>
            <p><strong>Fechamento do mês ${mesNome}/${ano}</strong></p>
            <p>Verifique seu valor abaixo:</p>
          </div>

          <!-- Valor Principal -->
          <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 25px; border-radius: 12px; margin: 20px 0; text-align: center; box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);">
            <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Valor a Receber</p>
            <h1 style="color: white; margin: 10px 0; font-size: 3rem; font-weight: bold;">${valorFormatado}</h1>
            ${valor_editado ? '<p style="color: rgba(255,255,255,0.8); margin: 0; font-size: 12px;">⚠️ Valor ajustado manualmente</p>' : ''}
          </div>

          <!-- Informações Detalhadas -->
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <h3 style="color: #1976d2; margin-top: 0;">📊 Detalhes do Período</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 12px 0; color: #666;">📅 Período:</td>
                <td style="padding: 12px 0; text-align: right; font-weight: bold;">${mesNome}/${ano}</td>
              </tr>
              ${especialidade ? `
              <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 12px 0; color: #666;">💼 Especialidade:</td>
                <td style="padding: 12px 0; text-align: right; font-weight: bold;">${especialidade}</td>
              </tr>
              ` : ''}
              ${temMeta ? `
              <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 12px 0; color: #666;">🎯 Meta Mensal:</td>
                <td style="padding: 12px 0; text-align: right; font-weight: bold;">${metaFormatada}</td>
              </tr>
              ` : ''}
              <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 12px 0; color: #666;">📉 Faltas:</td>
                <td style="padding: 12px 0; text-align: right; font-weight: bold; color: ${faltas > 0 ? '#f44336' : '#4CAF50'};">${faltas || 0}</td>
              </tr>
              ${temMeta ? `
              <tr>
                <td style="padding: 12px 0; color: #666;">✅ Status da Meta:</td>
                <td style="padding: 12px 0; text-align: right;">
                  <span style="
                    background: ${meta_batida ? 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)' : 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'};
                    color: white;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: bold;
                    display: inline-block;
                  ">${meta_batida ? '✓ Meta Batida' : '○ Meta Não Batida'}</span>
                </td>
              </tr>
              ` : ''}
            </table>
          </div>

          ${informacoes_importantes ? `
          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #1976d2; font-size: 14px;">
              <strong>ℹ️ Informações Importantes:</strong> ${informacoes_importantes}
            </p>
          </div>
          ` : ''}

          ${!isAtivo ? `
          <!-- Aviso de Ativação de Conta -->
          <div style="background: linear-gradient(135deg, rgba(255, 152, 0, 0.1) 0%, rgba(245, 124, 0, 0.1) 100%); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
            <h3 style="margin: 0 0 10px 0; color: #f57c00; font-size: 16px;">⚠️ Ação Necessária: Ative seu Cadastro</h3>
            <p style="margin: 0 0 15px 0; color: #555; font-size: 14px;">
              Seu cadastro está <strong>inativo</strong>. Para acessar o sistema e visualizar mais informações sobre seus pagamentos${isPrestadorServico ? ', notas fiscais' : ''} e histórico, você precisa ativar sua conta.
            </p>
            <div style="text-align: center;">
              <a href="${this.emailConfig.frontend_url || process.env.FRONTEND_URL || getFrontendURL()}/confirmar-cadastro" 
                 style="
                   background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
                   color: white;
                   padding: 12px 24px;
                   text-decoration: none;
                   border-radius: 25px;
                   font-weight: bold;
                   display: inline-block;
                   box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3);
                 ">
                🔓 Ativar Cadastro
              </a>
            </div>
          </div>
          ` : ''}

          ${isPrestadorServico ? `
          <!-- Botão de Upload de Nota Fiscal (APENAS PARA PRESTADORES DE SERVIÇO) -->
          <div style="background: linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(69, 160, 73, 0.1) 100%); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
            <h3 style="margin: 0 0 10px 0; color: #2e7d32; font-size: 16px;">📄 Envio de Nota Fiscal</h3>
            <p style="margin: 0 0 15px 0; color: #555; font-size: 14px;">
              Por favor, envie sua nota fiscal referente a este período através do botão abaixo:
            </p>
            <div style="text-align: center;">
              <a href="${this.emailConfig.frontend_url || process.env.FRONTEND_URL || getFrontendURL()}/minhas-notas-fiscais?mes=${mes}&ano=${ano}" 
                 style="
                   background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                   color: white;
                   padding: 14px 28px;
                   text-decoration: none;
                   border-radius: 25px;
                   font-weight: bold;
                   display: inline-block;
                   box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
                   font-size: 15px;
                   ${!isAtivo ? 'opacity: 0.6; pointer-events: none;' : ''}
                 ">
                📤 Enviar Nota Fiscal
              </a>
            </div>
            <p style="margin: 15px 0 0 0; color: #666; font-size: 12px; text-align: center;">
              ⏰ Prazo: até o fim do mês referente
            </p>
            ${!isAtivo ? `
            <p style="margin: 10px 0 0 0; color: #f57c00; font-size: 12px; text-align: center; font-style: italic;">
              * Ative seu cadastro para enviar notas fiscais
            </p>
            ` : ''}
          </div>
          ` : ''}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.emailConfig.frontend_url || process.env.FRONTEND_URL || getFrontendURL()}/dashboard" 
               style="
                 background: linear-gradient(135deg, #0066FF 0%, #00D4FF 100%);
                 color: white;
                 padding: 12px 24px;
                 text-decoration: none;
                 border-radius: 25px;
                 font-weight: bold;
                 display: inline-block;
                 box-shadow: 0 4px 15px rgba(0, 102, 255, 0.3);
                 ${!isAtivo ? 'opacity: 0.6; pointer-events: none;' : ''}
               ">
              📊 Acessar Sistema
            </a>
            ${!isAtivo ? `
            <p style="margin: 10px 0 0 0; color: #f57c00; font-size: 12px; font-style: italic;">
              * Ative seu cadastro para acessar o sistema
            </p>
            ` : ''}
          </div>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #666; font-size: 12px; text-align: center;">
            Este é um email automático do <strong>${this.empresaNome}</strong>.
          </p>
        </div>
      `
    };

    // Adicionar comprovante como anexo se fornecido
    if (comprovanteAnexo) {
      mailOptions.attachments = [{
        filename: comprovanteAnexo.filename || 'comprovante-pagamento.pdf',
        path: comprovanteAnexo.path
      }];
    }

    try {
      if (!this.configurado) {
        logger.warn('Email not configured - simulating send', {
          type: 'comprovante_pagamento',
          recipient: email,
        });
        return true;
      }
      await this.transporter.sendMail(mailOptions);
      logger.email('Payment notification sent', email, {
        mes,
        ano,
        valor: valor_liquido,
        meta_batida
      });
      return true;
    } catch (error) {
      logger.error('Failed to send payment notification', error, { recipient: email });
      return false;
    }
  }

  // Enviar email de confirmação de upload de planilha
  async enviarConfirmacaoUpload(adminEmail, dados) {
    const { total, sucessos, erros, mes, ano } = dados;

    const mailOptions = {
      from: this.emailConfig.user || process.env.EMAIL_USER,
      to: adminEmail,
      subject: `✅ Planilha Processada - ${mes}/${ano}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, rgba(0,102,255,0.05) 0%, rgba(0,212,255,0.05) 100%); padding: 20px; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="
              width: 60px;
              height: 60px;
              margin: 0 auto 10px;
              background: linear-gradient(135deg, #0066FF 0%, #00D4FF 100%);
              border-radius: 15px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 2rem;
              font-weight: bold;
              color: white;
              box-shadow: 0 4px 20px rgba(0, 102, 255, 0.3);
            ">Z</div>
            <h1 style="
              background: linear-gradient(135deg, #0066FF 0%, #00D4FF 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
              font-size: 2rem;
              margin: 0;
            ">ZoraH</h1>
          </div>
          
          <h2 style="color: #1976d2;">📊 Planilha Processada com Sucesso</h2>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📈 Resumo do Processamento</h3>
            <ul style="list-style: none; padding: 0;">
              <li style="margin: 10px 0;">📅 <strong>Período:</strong> ${mes}/${ano}</li>
              <li style="margin: 10px 0;">👥 <strong>Total de Prestadores:</strong> ${total}</li>
              <li style="margin: 10px 0;">✅ <strong>Processados com Sucesso:</strong> ${sucessos}</li>
              <li style="margin: 10px 0;">❌ <strong>Erros:</strong> ${erros}</li>
            </ul>
          </div>
          
          <p>Os dados foram processados e estão disponíveis no sistema.</p>
          
          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #1976d2;">
              <strong>💡 Dica:</strong> Acesse o sistema para visualizar os relatórios detalhados.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">
            Este é um email automático do ZoraH.
          </p>
        </div>
      `
    };

    try {
      if (!this.configurado) {
        logger.warn('Email not configured - simulating send', {
          type: 'confirmacao_upload',
          recipient: adminEmail,
        });
        return true;
      }
      await this.transporter.sendMail(mailOptions);
      logger.email('Upload confirmation sent', adminEmail, {
        mes,
        ano,
        total,
        sucessos,
        erros,
      });
      return true;
    } catch (error) {
      logger.error('Failed to send upload confirmation email', error, {
        recipient: adminEmail,
        mes,
        ano,
      });
      return false;
    }
  }

  // Enviar lembrete de prazo de nota fiscal
  async enviarLembreteNotaFiscal(prestadorEmail, prestadorNome, dados) {
    const { mes, ano, prazo } = dados;

    const mailOptions = {
      from: this.emailConfig.user || process.env.EMAIL_USER,
      to: prestadorEmail,
      subject: `⚠️ Lembrete: Prazo para Nota Fiscal - ${mes}/${ano}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff9800;">⚠️ Lembrete de Prazo</h2>
          
          <div style="background-color: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
            <h3>📄 Nota Fiscal Pendente</h3>
            <p>Olá <strong>${prestadorNome}</strong>,</p>
            <p>Este é um lembrete sobre a nota fiscal do período <strong>${mes}/${ano}</strong>.</p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📅 Informações Importantes</h3>
            <ul style="list-style: none; padding: 0;">
              <li style="margin: 10px 0;">📅 <strong>Período:</strong> ${mes}/${ano}</li>
              <li style="margin: 10px 0;">⏰ <strong>Prazo:</strong> ${prazo}</li>
              <li style="margin: 10px 0;">📊 <strong>Status:</strong> Pendente</li>
            </ul>
          </div>
          
          <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #2e7d32;">
              <strong>🚀 Ação Necessária:</strong> Acesse o sistema e faça o upload da sua nota fiscal.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.emailConfig.frontend_url || process.env.FRONTEND_URL || getFrontendURL()}/notas-fiscais" 
               style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              📤 Enviar Nota Fiscal
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">
            Este é um email automático do ZoraH.
          </p>
        </div>
      `
    };

    try {
      if (!this.configurado) {
        logger.warn('Email not configured - simulating reminder', {
          type: 'lembrete_nota_fiscal',
          recipient: prestadorEmail,
        });
        return true;
      }
      await this.transporter.sendMail(mailOptions);
      logger.email('Invoice reminder sent', prestadorEmail, {
        prestadorNome,
        mes,
        ano,
        prazo,
      });
      return true;
    } catch (error) {
      logger.error('Failed to send invoice reminder', error, {
        recipient: prestadorEmail,
        prestadorNome,
      });
      return false;
    }
  }

  // Enviar notificação de nova nota fiscal recebida
  async enviarNotificacaoNotaRecebida(adminEmail, dados) {
    const { prestadorNome, mes, ano } = dados;

    const mailOptions = {
      from: this.emailConfig.user || process.env.EMAIL_USER,
      to: adminEmail,
      subject: `📄 Nova Nota Fiscal Recebida - ${prestadorNome}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4caf50;">📄 Nova Nota Fiscal</h2>
          
          <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>✅ Nota Fiscal Recebida</h3>
            <p>Uma nova nota fiscal foi enviada e está aguardando revisão.</p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📋 Detalhes</h3>
            <ul style="list-style: none; padding: 0;">
              <li style="margin: 10px 0;">👤 <strong>Prestador:</strong> ${prestadorNome}</li>
              <li style="margin: 10px 0;">📅 <strong>Período:</strong> ${mes}/${ano}</li>
              <li style="margin: 10px 0;">📊 <strong>Status:</strong> Aguardando Revisão</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.emailConfig.frontend_url || process.env.FRONTEND_URL || getFrontendURL()}/admin/prestadores" 
               style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              👀 Revisar Nota Fiscal
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">
            Este é um email automático do ZoraH.
          </p>
        </div>
      `
    };

    try {
      if (!this.configurado) {
        logger.warn('Email not configured - simulating notification', {
          type: 'notificacao_nota_recebida',
          recipient: adminEmail,
        });
        return true;
      }
      await this.transporter.sendMail(mailOptions);
      logger.email('Invoice received notification sent', adminEmail, {
        prestadorNome,
        mes,
        ano,
      });
      return true;
    } catch (error) {
      logger.error('Failed to send invoice notification', error, {
        recipient: adminEmail,
        prestadorNome,
      });
      return false;
    }
  }

  // Enviar apenas comprovante de pagamento (sem detalhes completos)
  async enviarApenasComprovante(email, dados, comprovanteAnexo) {
    if (!comprovanteAnexo) {
      throw new Error('Comprovante é obrigatório para este tipo de envio');
    }

    const { nome, mes, ano } = dados;
    const mesesNomes = {
      1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril',
      5: 'Maio', 6: 'Junho', 7: 'Julho', 8: 'Agosto',
      9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro'
    };
    const mesNome = mesesNomes[mes];

    const mailOptions = {
      from: this.emailConfig.user || process.env.EMAIL_USER,
      to: email,
      subject: `📄 Comprovante de Pagamento - ${mesNome}/${ano}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, rgba(0,102,255,0.05) 0%, rgba(0,212,255,0.05) 100%); padding: 30px; border-radius: 15px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="
              width: 80px;
              height: 80px;
              margin: 0 auto 15px;
              background: linear-gradient(135deg, #0066FF 0%, #00D4FF 100%);
              border-radius: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 40px;
            ">
              📄
            </div>
            <h1 style="
              margin: 0;
              font-size: 28px;
              background: linear-gradient(135deg, #0066FF 0%, #00D4FF 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            ">Comprovante de Pagamento</h1>
            <p style="color: #666; margin: 10px 0 0; font-size: 16px;">
              Referente a ${mesNome}/${ano}
            </p>
          </div>

          <!-- Mensagem Principal -->
          <div style="
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
            margin-bottom: 25px;
          ">
            <p style="margin: 0 0 15px; font-size: 16px; color: #333;">
              Olá <strong>${nome}</strong>,
            </p>
            <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
              Segue em anexo o comprovante de pagamento referente ao mês de <strong>${mesNome}/${ano}</strong>.
            </p>
            <p style="margin: 0; font-size: 16px; color: #333; line-height: 1.6;">
              O arquivo está anexado a este email para sua conferência e arquivamento.
            </p>
          </div>

          <!-- Info Box -->
          <div style="
            background: rgba(33, 150, 243, 0.1);
            border-left: 4px solid #2196F3;
            padding: 15px 20px;
            border-radius: 8px;
            margin-bottom: 25px;
          ">
            <p style="margin: 0; font-size: 14px; color: #1976d2; line-height: 1.6;">
              💡 <strong>Dica:</strong> Guarde este comprovante para seus registros financeiros.
            </p>
          </div>

          <!-- Footer -->
          <div style="text-align: center; padding-top: 20px; border-top: 1px solid rgba(0,0,0,0.1);">
            <p style="color: #999; font-size: 13px; margin: 0;">
              Este é um email automático. Por favor, não responda.
            </p>
            <p style="color: #999; font-size: 13px; margin: 10px 0 0;">
              © ${new Date().getFullYear()} Sistema de Faturamento
            </p>
          </div>
        </div>
      `,
      attachments: [comprovanteAnexo]
    };

    try {
      if (!this.configurado) {
        logger.warn('Email not configured - simulating voucher send', {
          type: 'comprovante_pagamento',
          recipient: email,
        });
        return true;
      }
      await this.transporter.sendMail(mailOptions);
      logger.email('Payment voucher sent', email, {
        mes,
        ano,
        hasAttachment: true,
      });
      return true;
    } catch (error) {
      logger.error('Failed to send payment voucher', error, {
        recipient: email,
      });
      return false;
    }
  }

  // Enviar email de boas-vindas para novos prestadores
  async enviarBoasVindas(prestadorEmail, prestadorNome, senhaTemporaria) {
    const mailOptions = {
      from: this.emailConfig.user || process.env.EMAIL_USER,
      to: prestadorEmail,
      subject: `🎉 Bem-vindo ao ZoraH`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">🎉 Bem-vindo!</h2>
          
          <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>👋 Olá ${prestadorNome}!</h3>
            <p>Seu cadastro foi criado no ZoraH.</p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>🔐 Suas Credenciais</h3>
            <ul style="list-style: none; padding: 0;">
              <li style="margin: 10px 0;">📧 <strong>Email:</strong> ${prestadorEmail}</li>
              <li style="margin: 10px 0;">🔑 <strong>Senha Temporária:</strong> ${senhaTemporaria}</li>
            </ul>
          </div>
          
          <div style="background-color: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #f57c00;">
              <strong>⚠️ Importante:</strong> Altere sua senha no primeiro acesso.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.emailConfig.frontend_url || process.env.FRONTEND_URL || getFrontendURL()}/login" 
               style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              🚀 Acessar Sistema
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">
            Este é um email automático do ZoraH.
          </p>
        </div>
      `
    };

    try {
      if (!this.configurado) {
        logger.warn('Email not configured - simulating welcome email', {
          type: 'boas_vindas',
          recipient: prestadorEmail,
        });
        return true;
      }
      await this.transporter.sendMail(mailOptions);
      logger.email('Welcome email sent', prestadorEmail, {
        prestadorNome,
      });
      return true;
    } catch (error) {
      logger.error('Failed to send welcome email', error, {
        recipient: prestadorEmail,
        prestadorNome,
      });
      return false;
    }
  }

  // Enviar alerta de erro crítico para admin
  async enviarAlertaErro(error, req = null) {
    const adminEmail = this.emailConfig.user || process.env.EMAIL_USER; // Enviar para o próprio email configurado

    const mailOptions = {
      from: this.emailConfig.user || process.env.EMAIL_USER,
      to: adminEmail,
      subject: `🚨 ERRO CRÍTICO - ${this.empresaNome}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">🚨 Erro Crítico no Sistema</h2>
          
          <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d32f2f;">
            <h3>⚠️ Detalhes do Erro</h3>
            <p><strong>Mensagem:</strong> ${error.message || 'Erro desconhecido'}</p>
            <p><strong>Timestamp:</strong> ${error.timestamp || new Date().toISOString()}</p>
            ${error.statusCode ? `<p><strong>Status Code:</strong> ${error.statusCode}</p>` : ''}
          </div>
          
          ${req ? `
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📍 Informações da Requisição</h3>
            <ul style="list-style: none; padding: 0;">
              <li style="margin: 10px 0;"><strong>Rota:</strong> ${req.method} ${req.path}</li>
              <li style="margin: 10px 0;"><strong>IP:</strong> ${req.ip}</li>
              <li style="margin: 10px 0;"><strong>User Agent:</strong> ${req.get('user-agent')}</li>
              ${req.user ? `<li style="margin: 10px 0;"><strong>Usuário:</strong> ${req.user.email}</li>` : ''}
            </ul>
          </div>
          ` : ''}
          
          ${error.stack ? `
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>🔍 Stack Trace</h3>
            <pre style="background-color: #263238; color: #aed581; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 12px;">${error.stack}</pre>
          </div>
          ` : ''}
          
          <div style="background-color: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #f57c00;">
              <strong>⚡ Ação Necessária:</strong> Verifique os logs do servidor e corrija o problema o mais rápido possível.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">
            Este é um alerta automático do ZoraH.
          </p>
        </div>
      `
    };

    try {
      if (!this.configurado) {
        logger.warn('Email not configured - cannot send error alert', {
          error: error.message,
        });
        return false;
      }
      await this.transporter.sendMail(mailOptions);
      logger.info('Error alert email sent', {
        error: error.message,
        recipient: adminEmail,
      });
      return true;
    } catch (emailError) {
      logger.error('Failed to send error alert email', emailError);
      return false;
    }
  }

  // Verificar se o serviço de email está configurado
  isConfigurado() {
    return this.configurado;
  }
}

module.exports = new EmailService(); 