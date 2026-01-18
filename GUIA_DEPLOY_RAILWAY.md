# 🚀 Guia Completo: Deploy no Railway

## 📌 Visão Geral

Este guia mostra como fazer o deploy completo do Sistema de Faturamento no Railway, incluindo:
- ✅ Backend (Node.js/Express)
- ✅ Frontend (React/Vite)
- ✅ Banco de Dados (PostgreSQL)
- ✅ Criação automática de tabelas
- ✅ Usuário master pré-configurado

---

## 🎯 Pré-requisitos

1. Conta no Railway: https://railway.app
2. Repositório Git (GitHub/GitLab) com o código
3. Código commitado e pushed

---

## 📦 Passo 1: Deploy do Backend

### 1.1 Criar Projeto no Railway

1. Acesse: https://railway.app/new
2. Clique em **"New Project"**
3. Selecione **"Deploy from GitHub repo"**
4. Escolha o repositório do seu projeto
5. Selecione a pasta **`backend`** (ou root se backend estiver na raiz)

### 1.2 Adicionar PostgreSQL

1. No projeto criado, clique em **"+ New"**
2. Selecione **"Database"** → **"PostgreSQL"**
3. Railway criará automaticamente a variável `DATABASE_URL`

### 1.3 Configurar Variáveis de Ambiente do Backend

No painel do Backend, vá em **"Variables"** e adicione:

```bash
# Ambiente
NODE_ENV=production

# Porta (Railway define automaticamente, mas pode especificar)
PORT=5001

# JWT Secret (IMPORTANTE: Gere um segredo forte!)
JWT_SECRET=sua_chave_secreta_super_segura_aqui_12345

# Email (Configurações do Gmail ou outro serviço SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=seu.email@gmail.com
EMAIL_PASS=sua_senha_de_app_do_gmail
EMAIL_FROM=noreply@sistema.com

# Frontend URL (será preenchida depois)
FRONTEND_URL=https://seu-frontend.up.railway.app
```

**⚠️ IMPORTANTE sobre EMAIL_PASS:**
- NÃO use sua senha do Gmail diretamente!
- Use uma "Senha de App" do Gmail:
  1. Acesse: https://myaccount.google.com/apppasswords
  2. Crie uma nova senha de app
  3. Use essa senha gerada

### 1.4 Verificar o Deploy

1. Railway fará o build e deploy automaticamente
2. Aguarde o deploy concluir (pode levar 2-5 minutos)
3. Verifique os logs em **"Deployments"** → **"View Logs"**

### 1.5 Testar o Backend

1. Copie a URL do backend (ex: `https://seu-backend.up.railway.app`)
2. Teste no navegador: `https://seu-backend.up.railway.app`
3. Você deve ver:
```json
{
  "message": "Sistema de Faturamento API",
  "version": "1.0.0",
  "status": "running"
}
```

### 1.6 Verificar Criação do Usuário Master

O sistema já está configurado para criar automaticamente:
- **Email:** kalebe.caldas@hotmail.com
- **Senha:** mxskqgltne
- **Tipo:** admin

Isso acontece automaticamente no primeiro deploy quando o `initDatabase()` roda.

---

## 🎨 Passo 2: Deploy do Frontend

### 2.1 Criar Novo Serviço no Railway

1. No mesmo projeto, clique em **"+ New"**
2. Selecione **"GitHub Repo"**
3. Escolha o mesmo repositório
4. **IMPORTANTE:** No **"Root Directory"**, especifique: `frontend-premium`

### 2.2 Configurar Variável de Ambiente do Frontend

No painel do Frontend, vá em **"Variables"** e adicione:

```bash
# URL do Backend (use a URL do backend que você copiou)
VITE_API_URL=https://seu-backend.up.railway.app/api
```

**⚠️ ATENÇÃO:**
- Substitua `seu-backend.up.railway.app` pela URL real do seu backend
- NÃO esqueça o `/api` no final!

### 2.3 Verificar o Deploy

1. Railway fará build e deploy automaticamente
2. Aguarde completar (pode levar 3-7 minutos)
3. Verifique os logs

### 2.4 Testar o Frontend

1. Copie a URL do frontend (ex: `https://seu-frontend.up.railway.app`)
2. Abra no navegador
3. Você deve ver a tela de login

---

## 🔗 Passo 3: Conectar Backend e Frontend

### 3.1 Atualizar CORS no Backend

Volte nas variáveis do **Backend** e atualize:

```bash
FRONTEND_URL=https://seu-frontend.up.railway.app
```

(Troque pela URL real do seu frontend)

### 3.2 Fazer Redeploy

Após atualizar a variável, o Railway fará redeploy automaticamente.
Se não, clique em **"Deploy"** → **"Redeploy"**

---

## ✅ Passo 4: Verificação Final

### 4.1 Testar Login

1. Acesse o frontend
2. Faça login com:
   - **Email:** kalebe.caldas@hotmail.com
   - **Senha:** mxskqgltne

### 4.2 Verificar Tabelas do Banco

As tabelas são criadas automaticamente no primeiro deploy através do `initDatabase()`.

Se quiser verificar manualmente:

```bash
# Instale Railway CLI
npm install -g @railway/cli

# Faça login
railway login

# Conecte ao projeto
railway link

# Conecte ao PostgreSQL
railway connect postgres
```

No PostgreSQL, execute:
```sql
\dt -- Lista todas as tabelas
SELECT * FROM usuarios; -- Ver usuários criados
```

---

## 🎛️ Recursos Adicionais

### Custom Domain (Opcional)

1. No Railway, vá em **Settings** → **Domains**
2. Clique em **"Add Custom Domain"**
3. Configure seu DNS conforme instruções

### Monitoramento

- **Logs:** Deployments → View Logs
- **Métricas:** Metrics (CPU, RAM, Network)
- **Webhooks:** Settings → Webhooks

### Backup do Banco

```bash
railway run pg_dump $DATABASE_URL > backup.sql
```

---

## 🐛 Troubleshooting

### Erro: "Cannot connect to database"

**Solução:**
1. Verifique se o PostgreSQL está ativo
2. Confirme que `DATABASE_URL` está configurada
3. Veja logs do backend

### Erro: "CORS policy"

**Solução:**
1. Confirme que `FRONTEND_URL` está configurada no backend
2. Verifique se a URL está correta (sem barra no final)
3. Redeploy do backend

### Erro: "Failed to fetch" no frontend

**Solução:**
1. Verifique `VITE_API_URL` no frontend
2. Confirme que está apontando para backend correto
3. Teste a URL do backend diretamente no navegador

### Tabelas não foram criadas

**Solução:**
1. Veja os logs do backend após primeiro deploy
2. Procure por mensagens: "✅ Tabela usuarios criada"
3. Se não aparecer, execute manualmente via Railway CLI:

```bash
railway run node -e "require('./database/init').initDatabase()"
```

### Usuário master não foi criado

**Solução:**
Acesse a rota temporária (ela já existe no código):
```
https://seu-backend.up.railway.app/api/create-admin-now
```

Ou pelo Railway CLI:
```bash
railway run node setup-admin.js
```

---

## 📊 Estrutura Final

Após deploy completo:

```
Railway Project: sistema-faturamento
├── 🗄️ PostgreSQL
│   └── DATABASE_URL (automático)
│
├── ⚙️ Backend (Node.js)
│   ├── URL: https://sistema-backend.up.railway.app
│   └── Variáveis:
│       ├── NODE_ENV=production
│       ├── JWT_SECRET=...
│       ├── DATABASE_URL=... (automático)
│       ├── EMAIL_*=...
│       └── FRONTEND_URL=...
│
└── 🎨 Frontend (React)
    ├── URL: https://sistema-frontend.up.railway.app
    └── Variáveis:
        └── VITE_API_URL=https://...-backend.../api
```

---

## 💰 Custos Estimados

Railway cobra por uso:
- **Starter Plan:** $5 de crédito grátis/mês
- **Developer Plan:** $20/mês (inclui $20 de crédito)

Estimativa para este sistema:
- Backend: ~$3-5/mês
- Frontend: ~$1-2/mês
- PostgreSQL: ~$2-3/mês
- **Total:** ~$6-10/mês

---

## 🔐 Segurança

### Antes de ir para produção:

1. **Remover rota temporária de criar admin:**
   Comente ou remova as linhas 166-205 do `backend/server.js`

2. **Mudar senha do usuário master:**
   ```sql
   -- No PostgreSQL via Railway
   UPDATE usuarios 
   SET senha = '$2a$10$nova_senha_hash_aqui' 
   WHERE email = 'kalebe.caldas@hotmail.com';
   ```

3. **Configurar rate limiting** (já está parcialmente implementado)

4. **Revisar variáveis de ambiente** - não comitar segredos

---

## 📞 Suporte

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Status:** https://status.railway.app

---

## ✨ Próximos Passos

Após deploy bem-sucedido:

1. ✅ Fazer login no sistema
2. ✅ Cadastrar colaboradores
3. ✅ Fazer upload de planilhas
4. ✅ Configurar email (se ainda não fez)
5. ✅ Testar todas as funcionalidades
6. ✅ Configurar domínio customizado (opcional)
7. ✅ Configurar backup automático do banco

---

**🎉 Pronto! Seu sistema está no ar!**
