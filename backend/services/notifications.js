class NotificationService {
  constructor(io) {
    this.io = io;
  }

  // Notificar admins sobre nova planilha processada
  notifyPlanilhaProcessada(data) {
    this.io.to('type_admin').emit('planilha_atualizada', {
      type: 'planilha_processada',
      message: `Planilha processada com sucesso: ${data.total} prestadores`,
      data: data,
      timestamp: new Date()
    });
  }

  // Notificar admins sobre nova nota fiscal
  notifyNotaFiscalEnviada(data) {
    this.io.to('type_admin').emit('nota_recebida', {
      type: 'nota_fiscal_enviada',
      message: `Nova nota fiscal recebida de ${data.prestador}`,
      data: data,
      timestamp: new Date()
    });
  }

  // Notificar prestador sobre atualização de dados
  notifyPrestadorAtualizado(userId, data) {
    this.io.to(`user_${userId}`).emit('dados_atualizados', {
      type: 'dados_atualizados',
      message: 'Seus dados foram atualizados',
      data: data,
      timestamp: new Date()
    });
  }

  // Notificar sobre prazo de nota fiscal
  notifyPrazoNotaFiscal(userId, data) {
    this.io.to(`user_${userId}`).emit('prazo_nota_fiscal', {
      type: 'prazo_nota_fiscal',
      message: `Prazo para envio da nota fiscal do mês ${data.mes}/${data.ano}`,
      data: data,
      timestamp: new Date()
    });
  }

  // Notificação geral para todos os usuários
  broadcastToAll(event, data) {
    this.io.emit(event, {
      ...data,
      timestamp: new Date()
    });
  }

  // Notificação para tipo específico de usuário
  broadcastToType(userType, event, data) {
    this.io.to(`type_${userType}`).emit(event, {
      ...data,
      timestamp: new Date()
    });
  }
}

module.exports = NotificationService; 