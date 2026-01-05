# 📧 Como Funciona a Configuração de Email

## Visão Geral

O sistema de configuração de email permite que administradores configurem as credenciais SMTP diretamente pela interface web, sem precisar editar arquivos `.env`. As configurações são armazenadas no banco de dados e têm fallback para variáveis de ambiente.

---

## 🔄 Fluxo de Funcionamento

### 1. **Inicialização do Serviço**

Quando o servidor inicia, o `EmailService` é instanciado:

```javascript
// backend/services/emailService.js
constructor() {
  // Inicializa variáveis
  this.configurado = false;
  this.transporter = null;
  
  // Tenta carregar configurações do banco de dados
  this.loadConfig().catch(err => {
    logger.error('Failed to load email config on init', err);
  });
}
```

### 2. **Carregamento de Configurações** (`loadConfig()`)

O método `loadConfig()` segue esta ordem de prioridade:

```
1. Banco de Dados (tabela 'configuracoes')
   ↓ (se não encontrar)
2. Variáveis de Ambiente (.env)
   ↓ (se não encontrar)
3. Serviço não configurado
```

**Processo:**
- Busca configurações na tabela `configuracoes` com chaves:
  - `email_host`
  - `email_port`
  - `email_user`
  - `email_pass`
  - `email_secure`
  - `email_service`

- Se encontrar no banco → usa essas configurações
- Se não encontrar → usa variáveis de ambiente (`EMAIL_USER`, `EMAIL_PASS`, etc.)
- Se não encontrar nenhuma → serviço fica desabilitado

### 3. **Configuração do Transporter (Nodemailer)**

Dependendo do serviço escolhido:

**Serviços Pré-configurados (Gmail, Outlook, Yahoo):**
```javascript
{
  service: 'gmail',  // ou 'outlook', 'yahoo'
  auth: {
    user: 'seu-email@gmail.com',
    pass: 'sua-senha-ou-app-password'
  }
}
```

**Serviço Personalizado:**
```javascript
{
  host: 'smtp.exemplo.com',
  port: 587,
  secure: false,  // true para SSL, false para TLS
  auth: {
    user: 'seu-email@exemplo.com',
    pass: 'sua-senha'
  }
}
```

---

## 🎨 Interface do Usuário (Frontend)

### Página de Configurações (`/settings`)

**Campos disponíveis:**

1. **Serviço de Email** (dropdown)
   - Gmail
   - Outlook/Hotmail
   - Yahoo
   - Personalizado

2. **Configurações Específicas** (aparecem apenas se "Personalizado" for selecionado)
   - Host SMTP
   - Porta SMTP
   - Conexão Segura (SSL/TLS)

3. **Credenciais** (sempre visíveis)
   - Email/Usuário
   - Senha

4. **Ações**
   - **Salvar**: Salva as configurações no banco de dados
   - **Testar Conexão**: Testa se as credenciais estão corretas

---

## 🔌 API Endpoints

### `GET /api/settings`
**Descrição:** Busca todas as configurações do sistema

**Resposta:**
```json
{
  "email_host": "smtp.gmail.com",
  "email_port": "587",
  "email_user": "seu-email@gmail.com",
  "email_pass": "***",  // não retorna a senha por segurança
  "email_secure": "false",
  "email_service": "gmail",
  "meta_padrao": "5000",
  "prazo_nota_fiscal": "15"
}
```

### `POST /api/settings`
**Descrição:** Salva/atualiza configurações

**Body:**
```json
{
  "email_service": "gmail",
  "email_user": "seu-email@gmail.com",
  "email_pass": "sua-senha",
  "email_host": "smtp.gmail.com",
  "email_port": "587",
  "email_secure": "false"
}
```

**Processo:**
1. Salva no banco de dados (tabela `configuracoes`)
2. Se houver configurações de email → chama `emailService.reloadConfig()`
3. O serviço recarrega as configurações e reconstrói o transporter

### `POST /api/settings/test-email`
**Descrição:** Testa a conexão SMTP com as configurações atuais

**Resposta (sucesso):**
```json
{
  "success": true,
  "message": "Conexão SMTP estabelecida com sucesso"
}
```

**Resposta (erro):**
```json
{
  "success": false,
  "message": "Falha na conexão SMTP",
  "error": "Invalid login: 535-5.7.8 Username and Password not accepted"
}
```

---

## 💾 Armazenamento

### Tabela `configuracoes`

```sql
CREATE TABLE configuracoes (
  id INTEGER PRIMARY KEY,
  chave TEXT UNIQUE NOT NULL,    -- ex: 'email_user'
  valor TEXT NOT NULL,            -- ex: 'seu-email@gmail.com'
  descricao TEXT,                 -- ex: 'Configuração do sistema'
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Exemplo de registros:**
```
chave              | valor
-------------------|------------------
email_service      | gmail
email_user         | seu-email@gmail.com
email_pass         | sua-senha-criptografada
email_host         | smtp.gmail.com
email_port         | 587
email_secure       | false
```

---

## 🔄 Recarregamento de Configurações

Quando você salva novas configurações de email:

1. **Frontend** → `POST /api/settings` com novas configurações
2. **Backend** → Salva no banco de dados
3. **Backend** → Detecta que são configurações de email (`email_*`)
4. **Backend** → Chama `emailService.reloadConfig()`
5. **EmailService** → Busca novas configurações do banco
6. **EmailService** → Reconstrói o transporter com novas credenciais
7. **EmailService** → Pronto para usar imediatamente

**Importante:** Não é necessário reiniciar o servidor!

---

## 🔐 Segurança

### Proteção de Senha

- A senha **não é retornada** quando você busca as configurações (`GET /api/settings`)
- A senha é armazenada em texto no banco (poderia ser criptografada no futuro)
- Apenas administradores podem acessar/modificar configurações

### Autenticação

Todas as rotas de settings requerem:
- Token JWT válido (`authenticateToken`)
- Usuário do tipo `admin` (`requireAdmin`)

---

## 📝 Exemplos de Uso

### Exemplo 1: Configurar Gmail

1. Acesse `/settings` como admin
2. Selecione "Gmail" no dropdown
3. Preencha:
   - Email/Usuário: `seu-email@gmail.com`
   - Senha: Use uma **App Password** (não a senha normal)
4. Clique em "Salvar"
5. Clique em "Testar Conexão" para verificar

**Como criar App Password no Gmail:**
- Acesse: https://myaccount.google.com/apppasswords
- Gere uma senha de app
- Use essa senha no campo "Senha"

### Exemplo 2: Configurar Servidor Personalizado

1. Selecione "Personalizado"
2. Preencha:
   - Host SMTP: `smtp.exemplo.com`
   - Porta: `587`
   - Marque "Conexão Segura" se usar SSL
   - Email/Usuário: `seu-email@exemplo.com`
   - Senha: `sua-senha`
3. Salve e teste

### Exemplo 3: Usar Variáveis de Ambiente (Fallback)

Se não houver configurações no banco, o sistema usa `.env`:

```env
EMAIL_USER=seu-email@gmail.com
EMAIL_PASS=sua-senha
EMAIL_SERVICE=gmail
```

---

## 🐛 Troubleshooting

### "Email não configurado"
- Verifique se `email_user` e `email_pass` estão preenchidos
- Verifique se as configurações foram salvas no banco

### "Falha na conexão SMTP"
- **Gmail:** Use App Password, não a senha normal
- **Outlook:** Pode precisar habilitar "Aplicativos menos seguros"
- **Personalizado:** Verifique host, porta e se precisa de SSL/TLS

### Configurações não estão sendo aplicadas
- Verifique se clicou em "Salvar" antes de "Testar Conexão"
- Verifique os logs do servidor para erros
- Tente reiniciar o servidor (embora não seja necessário)

---

## 🔍 Logs

O sistema registra:
- Quando configurações são carregadas
- De onde vieram (banco ou .env)
- Erros de conexão SMTP
- Tentativas de envio de email

**Ver logs:**
```bash
tail -f backend/logs/application-*.log
```

---

## 📚 Arquivos Relacionados

- **Backend:**
  - `backend/services/emailService.js` - Lógica principal
  - `backend/routes/settings.js` - API endpoints
  - `backend/database/init.js` - Criação da tabela `configuracoes`

- **Frontend:**
  - `frontend-premium/src/pages/Settings.jsx` - Interface do usuário
  - `frontend-premium/src/styles/Settings.css` - Estilos

---

## ✅ Checklist de Configuração

- [ ] Acessar página de Configurações como admin
- [ ] Selecionar serviço de email (ou personalizado)
- [ ] Preencher email/usuário
- [ ] Preencher senha (ou App Password para Gmail)
- [ ] Se personalizado: preencher host, porta e SSL
- [ ] Clicar em "Salvar"
- [ ] Clicar em "Testar Conexão"
- [ ] Verificar mensagem de sucesso
- [ ] Testar envio de email real (ex: criar prestador)

---

**Última atualização:** Dezembro 2025

