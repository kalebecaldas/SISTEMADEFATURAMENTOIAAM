# 🛠️ Comandos Úteis - Railway Deploy

## 📦 Instalação do Railway CLI

```bash
# Via npm
npm install -g @railway/cli

# Verificar instalação
railway --version
```

## 🔐 Login e Configuração

```bash
# Fazer login no Railway
railway login

# Listar projetos
railway list

# Conectar a um projeto existente
railway link

# Iniciar novo projeto
railway init
```

## 🚀 Deploy Manual (via CLI)

```bash
# Deploy do backend
cd backend
railway up

# Deploy do frontend
cd frontend-premium
railway up
```

## 🔍 Monitoramento

```bash
# Ver logs em tempo real
railway logs

# Logs do backend
railway logs --service backend

# Logs do frontend
railway logs --service frontend

# Seguir logs (tail)
railway logs --tail
```

## 🗄️ Banco de Dados

```bash
# Conectar ao PostgreSQL
railway connect postgres

# Dentro do PostgreSQL:
\dt                          # Listar tabelas
\d usuarios                  # Descrever tabela usuarios
SELECT * FROM usuarios;      # Ver todos os usuários
\q                           # Sair

# Executar query direta
railway run psql $DATABASE_URL -c "SELECT * FROM usuarios;"

# Backup do banco
railway run pg_dump $DATABASE_URL > backup.sql

# Restaurar backup
railway run psql $DATABASE_URL < backup.sql
```

## ⚙️ Variáveis de Ambiente

```bash
# Listar variáveis
railway variables

# Adicionar variável
railway variables set NODE_ENV=production

# Adicionar múltiplas variáveis
railway variables set \
  JWT_SECRET=sua_chave_aqui \
  EMAIL_HOST=smtp.gmail.com \
  EMAIL_PORT=587

# Remover variável
railway variables delete VARIAVEL_ANTIGA
```

## 🔄 Deploy e Redeploy

```bash
# Redeploy (sem mudanças de código)
railway redeploy

# Deploy específico de um serviço
railway up --service backend

# Deploy com logs visíveis
railway up --verbose
```

## 🧪 Testes e Debug

```bash
# Executar comando no servidor
railway run node --version

# Executar script no servidor
railway run node create_admin.js

# Inicializar banco manualmente
railway run node -e "require('./database/init').initDatabase()"

# Testar conexão de email
railway run node -e "require('./services/emailService').testarConexao()"

# Abrir shell no container
railway run bash

# Verificar variáveis dentro do container
railway run env
```

## 📊 Status e Informações

```bash
# Status do projeto
railway status

# Informações do projeto
railway info

# Listar serviços
railway service

# Abrir projeto no navegador
railway open

# Abrir dashboard
railway dashboard
```

## 🌐 Domínios

```bash
# Listar domínios
railway domain

# Adicionar domínio customizado
railway domain add meudominio.com

# Gerar domínio Railway
railway domain generate
```

## 🔧 Comandos Específicos do Projeto

### Criar Admin Manualmente

```bash
# Via rota temporária (se o backend estiver rodando)
curl https://seu-backend.railway.app/api/create-admin-now

# Via script
railway run node setup-admin.js

# Via SQL direto
railway connect postgres
# Depois execute o SQL de create_admin.sql
```

### Verificar Tabelas

```bash
# Conectar ao banco
railway connect postgres

# No psql:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

# Contar registros em cada tabela
SELECT 'usuarios' as tabela, COUNT(*) FROM usuarios
UNION ALL
SELECT 'dados_mensais', COUNT(*) FROM dados_mensais
UNION ALL
SELECT 'notas_fiscais', COUNT(*) FROM notas_fiscais;
```

### Resetar Senha do Admin

```bash
railway connect postgres

# No psql:
UPDATE usuarios 
SET senha = '$2a$10$YourHashedPasswordHere' 
WHERE email = 'kalebe.caldas@hotmail.com';
```

### Limpar Cache e Rebuild

```bash
# Forçar rebuild completo
railway up --force

# Limpar cache do build
railway build --nocache
```

## 📦 NPM no Servidor

```bash
# Instalar dependência no servidor
railway run npm install nome-do-pacote

# Listar dependências instaladas
railway run npm list

# Verificar versão do Node
railway run node --version

# Verificar versão do NPM
railway run npm --version
```

## 🔒 Segurança

```bash
# Gerar JWT_SECRET forte
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Ou online:
openssl rand -hex 64

# Hash de senha (bcrypt)
node -e "console.log(require('bcryptjs').hashSync('minhasenha', 10))"
```

## 📈 Performance

```bash
# Ver uso de recursos
railway metrics

# Ver custos
railway billing
```

## 🐛 Troubleshooting

### Backend não inicia

```bash
# Ver logs detalhados
railway logs --service backend --tail

# Verificar variáveis
railway variables

# Testar build local
cd backend
npm install
npm start

# Verificar se PORT está definida
railway run echo $PORT
```

### Frontend não conecta ao Backend

```bash
# Verificar variável VITE_API_URL
railway variables --service frontend

# Ver build do frontend
railway logs --service frontend

# Testar URL do backend
curl https://seu-backend.railway.app/api
```

### Banco de dados não conecta

```bash
# Verificar DATABASE_URL
railway variables | grep DATABASE_URL

# Testar conexão
railway connect postgres

# Ver logs de erro do PostgreSQL
railway logs --service postgres
```

### CORS Error

```bash
# Verificar FRONTEND_URL no backend
railway variables --service backend | grep FRONTEND_URL

# Deve ser:
# FRONTEND_URL=https://seu-frontend.railway.app (SEM barra no final)
```

## 📚 Comandos de Manutenção

```bash
# Restart do serviço
railway restart

# Pausar projeto (parar cobranças)
railway pause

# Resumir projeto
railway resume

# Deletar deployment específico
railway deployment delete DEPLOYMENT_ID

# Ver histórico de deploys
railway deployments
```

## 🔄 CI/CD Integration

```bash
# Gerar token para CI/CD
railway tokens create

# Usar em GitHub Actions
# Adicione o token em: Settings → Secrets → RAILWAY_TOKEN
```

## 💾 Backup e Restore

```bash
# Backup completo do banco
timestamp=$(date +%Y%m%d_%H%M%S)
railway run pg_dump $DATABASE_URL > backup_$timestamp.sql

# Backup apenas dados (sem estrutura)
railway run pg_dump --data-only $DATABASE_URL > data_backup.sql

# Backup apenas estrutura (sem dados)
railway run pg_dump --schema-only $DATABASE_URL > schema_backup.sql

# Restore
railway run psql $DATABASE_URL < backup.sql
```

## 📝 Exemplos Práticos

### Deploy Inicial Completo

```bash
# 1. Login
railway login

# 2. Link ao projeto
railway link

# 3. Configurar variáveis do backend
railway variables set \
  NODE_ENV=production \
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") \
  EMAIL_HOST=smtp.gmail.com \
  EMAIL_PORT=587 \
  EMAIL_USER=seu@email.com \
  EMAIL_PASS=sua_senha_app \
  EMAIL_FROM=noreply@sistema.com

# 4. Deploy backend
cd backend
railway up

# 5. Pegar URL do backend
railway open

# 6. Configurar frontend
cd ../frontend-premium
railway variables set VITE_API_URL=https://seu-backend.railway.app/api

# 7. Deploy frontend
railway up

# 8. Pegar URL do frontend e atualizar backend
URL_FRONTEND=$(railway open | grep -o 'https://[^/]*')
cd ../backend
railway variables set FRONTEND_URL=$URL_FRONTEND

# 9. Ver logs
railway logs --tail
```

### Atualização Rápida

```bash
# Commit local
git add .
git commit -m "Update"
git push

# Railway faz deploy automático!
# Ver progresso:
railway logs --tail
```

### Debug de Problema

```bash
# 1. Ver logs recentes
railway logs --lines 100

# 2. Verificar variáveis
railway variables

# 3. Testar conexão com banco
railway connect postgres
\conninfo
\q

# 4. Verificar status
railway status

# 5. Se necessário, restart
railway restart
```

## 🆘 Comandos de Emergência

```bash
# Rollback para deploy anterior
railway deployments list
railway rollback DEPLOYMENT_ID

# Parar tudo (emergência)
railway pause

# Recriar banco (CUIDADO!)
railway service delete postgres
railway add --service postgres

# Limpar e rebuild
railway up --force --nocache
```

---

## 📞 Ajuda

```bash
# Ajuda geral
railway --help

# Ajuda de comando específico
railway logs --help
railway variables --help
railway up --help
```

---

**💡 Dica:** Adicione alias úteis no seu `.bashrc` ou `.zshrc`:

```bash
# ~/.zshrc ou ~/.bashrc
alias rl='railway logs --tail'
alias rs='railway status'
alias rv='railway variables'
alias ru='railway up'
alias ro='railway open'
```

Depois: `source ~/.zshrc`

Agora pode usar simplesmente: `rl` para ver logs, `rs` para status, etc!
