const cron = require('node-cron');
const { db } = require('../database/init');
const emailService = require('./emailService');

class SchedulerService {
  constructor() {
    this.jobs = new Map();
  }

  // Inicializar todos os agendamentos
  init() {
    console.log('🕐 Inicializando agendamentos...');

    // Lembretes automáticos de NF (configurável)
    this.scheduleAutomatedNFReminders();

    // Verificar prestadores sem dados mensais semanalmente
    this.schedulePrestadoresSemDados();

    console.log('✅ Agendamentos inicializados');
  }

  // Agendar lembretes automáticos de NF
  async scheduleAutomatedNFReminders() {
    try {
      // Buscar configurações
      const config = await db('configuracoes')
        .where('chave', 'lembrete_nf_ativo')
        .orWhere('chave', 'lembrete_nf_intervalo_dias')
        .orWhere('chave', 'lembrete_nf_horario')
        .select('chave', 'valor');

      const configMap = {};
      config.forEach(c => configMap[c.chave] = c.valor);

      const ativo = configMap.lembrete_nf_ativo === 'true';
      const intervalo = parseInt(configMap.lembrete_nf_intervalo_dias) || 2;
      const horario = configMap.lembrete_nf_horario || '12:00';

      if (!ativo) {
        console.log('⏸️ Lembretes automáticos de NF desativados');
        return;
      }

      // Parse horário (formato: HH:MM)
      const [hora, minuto] = horario.split(':').map(n => parseInt(n));

      // Executar diariamente no horário configurado
      const cronExpression = `${minuto} ${hora} * * *`;

      const job = cron.schedule(cronExpression, async () => {
        console.log('📧 Executando lembretes automáticos de NF...');
        await this.enviarLembretesAutomaticos(intervalo);
      }, {
        scheduled: true,
        timezone: 'America/Sao_Paulo'
      });

      this.jobs.set('automatedNFReminders', job);
      console.log(`📧 Lembretes automáticos de NF agendados (${horario} diariamente, intervalo: ${intervalo} dias)`);
    } catch (error) {
      console.error('❌ Erro ao agendar lembretes automáticos:', error);
    }
  }

  // Enviar lembretes automáticos
  async enviarLembretesAutomaticos(intervaloDias) {
    try {
      const hoje = new Date();
      const mesReferencia = hoje.getMonth(); // Mês anterior
      const anoReferencia = mesReferencia === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear();
      const mesAtual = mesReferencia === 0 ? 12 : mesReferencia;

      // Buscar prestadores de serviço com valor no mês mas sem NF enviada
      const colaboradores = await db('usuarios as u')
        .join('dados_mensais as dm', 'u.id', 'dm.prestador_id')
        .leftJoin('notas_fiscais as nf', function () {
          this.on('u.id', '=', 'nf.prestador_id')
            .andOn('nf.mes', '=', 'dm.mes')
            .andOn('nf.ano', '=', 'dm.ano');
        })
        .leftJoin('lembretes_enviados as le', function () {
          this.on('u.id', '=', 'le.colaborador_id')
            .andOn('le.mes', '=', 'dm.mes')
            .andOn('le.ano', '=', 'dm.ano')
            .andOn('le.tipo', '=', db.raw('?', ['automatico']));
        })
        .select(
          'u.id',
          'u.nome',
          'u.email',
          'dm.mes',
          'dm.ano',
          'dm.valor_liquido',
          db.raw('MAX(le.data_envio) as ultimo_lembrete')
        )
        .where({
          'u.tipo_colaborador': 'prestador_servico',
          'u.ativo': 1,
          'dm.mes': mesAtual,
          'dm.ano': anoReferencia
        })
        .whereNull('nf.id')
        .whereRaw('dm.valor_liquido > 0')
        .groupBy('u.id', 'u.nome', 'u.email', 'dm.mes', 'dm.ano', 'dm.valor_liquido');

      console.log(`📊 ${colaboradores.length} colaboradores com NF pendente`);

      let enviados = 0;
      for (const colab of colaboradores) {
        // Verificar se já passou o intervalo desde o último lembrete
        if (colab.ultimo_lembrete) {
          const ultimoLembrete = new Date(colab.ultimo_lembrete);
          const diasDesdeUltimo = Math.floor((hoje - ultimoLembrete) / (1000 * 60 * 60 * 24));

          if (diasDesdeUltimo < intervaloDias) {
            continue; // Ainda não passou o intervalo
          }
        }

        // Enviar lembrete
        if (emailService.isConfigurado()) {
          await emailService.enviarLembreteNotaFiscal(
            colab.email,
            colab.nome,
            {
              mes: colab.mes,
              ano: colab.ano,
              prazo: `Final do mês ${colab.mes}/${colab.ano}`
            }
          );

          // Registrar lembrete enviado
          await db('lembretes_enviados').insert({
            colaborador_id: colab.id,
            mes: colab.mes,
            ano: colab.ano,
            tipo: 'automatico',
            enviado_por: null
          });

          enviados++;
          console.log(`✅ Lembrete enviado para ${colab.nome}`);

          // Aguardar 1 segundo entre emails
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`📧 Total de lembretes automáticos enviados: ${enviados}`);
    } catch (error) {
      console.error('❌ Erro ao enviar lembretes automáticos:', error);
    }
  }

  // Agendar verificação de prestadores sem dados
  schedulePrestadoresSemDados() {
    // Executar toda segunda-feira às 8h
    const job = cron.schedule('0 8 * * 1', async () => {
      console.log('👥 Verificando prestadores sem dados...');
      await this.verificarPrestadoresSemDados();
    }, {
      scheduled: true,
      timezone: 'America/Sao_Paulo'
    });

    this.jobs.set('prestadoresSemDados', job);
    console.log('👥 Verificação de prestadores agendada (Segunda 8h)');
  }

  // Verificar lembretes de nota fiscal
  async verificarLembretesNotaFiscal() {
    try {
      const hoje = new Date();
      const mesAtual = hoje.getMonth() + 1;
      const anoAtual = hoje.getFullYear();

      // Buscar prestadores que ainda não enviaram nota fiscal
      const prestadores = await db('usuarios as u')
        .leftJoin('dados_mensais as dm', 'u.id', 'dm.prestador_id')
        .leftJoin('notas_fiscais as nf', function () {
          this.on('u.id', '=', 'nf.prestador_id')
            .andOn('nf.mes', '=', db.raw('?', [mesAtual]))
            .andOn('nf.ano', '=', db.raw('?', [anoAtual]));
        })
        .select('u.id', 'u.nome', 'u.email', 'dm.mes', 'dm.ano')
        .where({
          'u.tipo': 'prestador',
          'u.ativo': 1,
          'dm.mes': mesAtual,
          'dm.ano': anoAtual
        })
        .whereNull('nf.id');

      console.log(`📧 Enviando ${prestadores.length} lembretes de nota fiscal`);

      for (const prestador of prestadores) {
        if (emailService.isConfigurado()) {
          const prazo = process.env.PRAZO_NOTA_FISCAL || 15;
          const dataLimite = new Date(anoAtual, mesAtual - 1, prazo);

          // Só enviar se estiver próximo do prazo (3 dias antes)
          const diasParaPrazo = Math.ceil((dataLimite - hoje) / (1000 * 60 * 60 * 24));

          if (diasParaPrazo <= 3 && diasParaPrazo > 0) {
            await emailService.enviarLembreteNotaFiscal(
              prestador.email,
              prestador.nome,
              {
                mes: prestador.mes,
                ano: prestador.ano,
                prazo: `${prazo}/${mesAtual}/${anoAtual}`
              }
            );

            // Aguardar 1 segundo entre emails para não sobrecarregar
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro ao verificar lembretes de nota fiscal:', error);
    }
  }

  // Verificar prestadores sem dados mensais
  async verificarPrestadoresSemDados() {
    try {
      const hoje = new Date();
      const mesAtual = hoje.getMonth() + 1;
      const anoAtual = hoje.getFullYear();

      // Buscar prestadores ativos sem dados do mês atual
      const prestadores = await db('usuarios as u')
        .leftJoin('dados_mensais as dm', function () {
          this.on('u.id', '=', 'dm.prestador_id')
            .andOn('dm.mes', '=', db.raw('?', [mesAtual]))
            .andOn('dm.ano', '=', db.raw('?', [anoAtual]));
        })
        .select('u.id', 'u.nome', 'u.email')
        .where({
          'u.tipo': 'prestador',
          'u.ativo': 1
        })
        .whereNull('dm.id');

      console.log(`📊 ${prestadores.length} prestadores sem dados do mês ${mesAtual}/${anoAtual}`);

      // Aqui você pode implementar notificação para admin sobre prestadores sem dados
      if (prestadores.length > 0) {
        console.log('⚠️ Prestadores sem dados mensais:', prestadores.map(p => p.nome).join(', '));
      }
    } catch (error) {
      console.error('❌ Erro ao verificar prestadores sem dados:', error);
    }
  }

  // Executar verificação manual (para testes)
  async executarVerificacaoManual() {
    console.log('🔧 Executando verificação manual...');
    await this.verificarLembretesNotaFiscal();
    await this.verificarPrestadoresSemDados();
    console.log('✅ Verificação manual concluída');
  }

  // Parar todos os agendamentos
  stop() {
    console.log('🛑 Parando agendamentos...');
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`🛑 Agendamento ${name} parado`);
    }
    this.jobs.clear();
  }

  // Listar agendamentos ativos
  listarAgendamentos() {
    const agendamentos = [];
    for (const [name, job] of this.jobs) {
      agendamentos.push({
        nome: name,
        ativo: job.running,
        proximaExecucao: job.nextDate()
      });
    }
    return agendamentos;
  }
}

module.exports = new SchedulerService();