# 📧 Configuração do Sistema de Email

## Visão Geral

O sistema de email permite enviar notificações automáticas para:
- ✅ Confirmação de upload de planilha
- ⚠️ Lembretes de prazo de nota fiscal
- 📄 Notificações de novas notas fiscais recebidas
- 🎉 Emails de boas-vindas para novos prestadores

## Configuração do Gmail

### 1. Ativar Autenticação de 2 Fatores
1. Acesse: https://myaccount.google.com/security
2. Ative a "Verificação em duas etapas"

### 2. Gerar Senha de App
1. Acesse: https://myaccount.google.com/apppasswords
2. Selecione "Email" como app
3. Clique em "Gerar"
4. Copie a senha gerada (16 caracteres)

### 3. Configurar Variáveis de Ambiente

Crie ou edite o arquivo `.env` no diretório `backend/`:

```env
# Configurações de Email
EMAIL_USER=seu_email@gmail.com
EMAIL_PASS=sua_senha_de_app_16_caracteres
FRONTEND_URL=http://localhost:3001

# Configurações do Sistema
PRAZO_NOTA_FISCAL=15
META_PADRAO=5000
```

## Agendamentos Automáticos

### Lembretes de Nota Fiscal
- **Frequência**: Diariamente às 9h
- **Função**: Verifica prestadores com notas fiscais pendentes
- **Envio**: 3 dias antes do prazo configurado

### Verificação de Prestadores
- **Frequência**: Segunda-feira às 8h
- **Função**: Identifica prestadores sem dados mensais

## Testando o Sistema

### 1. Verificar Configuração
Acesse: `http://localhost:3001/admin/scheduler`

### 2. Executar Verificação Manual
Use o botão "Executar Verificação Manual" para testar imediatamente.

### 3. Verificar Logs
Monitore os logs do servidor para ver as execuções:
```bash
cd backend
npm run dev
```

## Tipos de Email

### 1. Confirmação de Upload
Enviado automaticamente quando uma planilha é processada com sucesso.

### 2. Lembrete de Nota Fiscal
Enviado 3 dias antes do prazo para prestadores com notas pendentes.

### 3. Notificação de Nova Nota
Enviado para o admin quando uma nova nota fiscal é recebida.

### 4. Email de Boas-vindas
Enviado para novos prestadores com suas credenciais.

## Solução de Problemas

### Email não enviado
1. Verifique se `EMAIL_USER` e `EMAIL_PASS` estão configurados
2. Confirme se a autenticação de 2 fatores está ativa
3. Verifique se a senha de app está correta

### Erro de autenticação
- Gere uma nova senha de app
- Verifique se o email está correto
- Confirme se a verificação em duas etapas está ativa

### Agendamentos não funcionam
1. Verifique se o servidor está rodando
2. Confirme se o timezone está correto (America/Sao_Paulo)
3. Teste com verificação manual

## Segurança

- ✅ Nunca commite o arquivo `.env` no Git
- ✅ Use senhas de app, não a senha principal
- ✅ Mantenha as credenciais seguras
- ✅ Monitore os logs de envio

## Personalização

### Alterar Horários
Edite o arquivo `backend/services/schedulerService.js`:

```javascript
// Lembretes diários às 9h
cron.schedule('0 9 * * *', async () => {
  // código aqui
});

// Verificação semanal às segundas 8h
cron.schedule('0 8 * * 1', async () => {
  // código aqui
});
```

### Alterar Templates
Edite o arquivo `backend/services/emailService.js` para personalizar os templates de email.

### Alterar Prazos
Configure no `.env`:
```env
PRAZO_NOTA_FISCAL=15  # Dia do mês
``` 