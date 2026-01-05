# Sistema de Faturamento - Deploy no Railway

## 🚀 Deploy Automático

### 1. Preparação do Backend

#### Instalar Railway CLI (opcional):
```bash
npm install -g @railway/cli
railway login
```

#### Ou usar a interface web: https://railway.app

### 2. Deploy do Backend

1. **Criar novo projeto no Railway:**
   - Acesse https://railway.app/new
   - Clique em "Deploy from GitHub repo"
   - Selecione o repositório
   - Railway detectará automaticamente que é Node.js

2. **Configurar Variáveis de Ambiente:**
   ```
   NODE_ENV=production
   PORT=5001
   JWT_SECRET=<gere_um_segredo_forte_aqui>
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=<seu_email>
   EMAIL_PASS=<senha_app_gmail>
   EMAIL_FROM=noreply@sistema.com
   ```

3. **Adicionar PostgreSQL:**
   - No seu projeto Railway, clique em "New"
   - Selecione "Database" → "PostgreSQL"
   - Railway criará automaticamente `DATABASE_URL`

4. **Deploy Automático:**
   - Railway fará deploy automaticamente ao detectar push no GitHub
   - Ou manualmente: `railway up` (se usar CLI)

### 3. Deploy do Frontend

1. **Build do Frontend:**
   ```bash
   cd frontend-premium
   npm install
   npm run build
   ```

2. **Opção 1: Deploy Frontend Separado (Recomendado)**
   - Criar outro serviço no Railway
   - Selecionar pasta `frontend-premium`
   - Railway detectará Vite/React
   - Configurar variável:
     ```
     VITE_API_URL=https://seu-backend.railway.app
     ```

3. **Opção 2: Servir Frontend pelo Backend**
   - Copiar build para backend:
     ```bash
     cp -r frontend-premium/dist backend/public
     ```
   - Backend já está configurado para servir arquivos estáticos

### 4. Configuração Pós-Deploy

1. **Testar API:**
   ```bash
   curl https://seu-backend.railway.app/
   ```

2. **Criar usuário admin:**
   ```bash
   railway run node create_admin.js
   ```

3. **Rodar migrations:**
   - Migrations rodam automaticamente no `initDatabase()`

### 5. Atualizar Frontend para Produção

No arquivo `frontend-premium/src/services/api.js`:
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
```

### 6. Variáveis de Ambiente Necessárias

**Backend:**
- `NODE_ENV` - production
- `PORT` - 5001 (Railway define automaticamente)
- `JWT_SECRET` - Segredo para JWT (gere um forte)
- `DATABASE_URL` - PostgreSQL (Railway cria automaticamente)
- `EMAIL_HOST` - SMTP host
- `EMAIL_PORT` - SMTP port
- `EMAIL_USER` - Email para envio
- `EMAIL_PASS` - Senha do email
- `EMAIL_FROM` - Email remetente
- `FRONTEND_URL` - URL do frontend (para CORS)

**Frontend:**
- `VITE_API_URL` - URL do backend

### 7. Comandos Úteis (Railway CLI)

```bash
# Ver logs
railway logs

# Conectar ao PostgreSQL
railway connect postgres

# Executar comando no servidor
railway run <comando>

# Ver variáveis de ambiente
railway variables

# Abrir projeto no browser
railway open
```

### 8. Estrutura de URLs

Após deploy:
- **Backend:** `https://sistema-faturamento-backend.railway.app`
- **Frontend:** `https://sistema-faturamento-frontend.railway.app`
- **Database:** Interno (connection string em `DATABASE_URL`)

### 9. Troubleshooting

**Erro de CORS:**
```javascript
// No backend server.js, adicione sua URL do frontend:
const io = socketIo(server, {
  cors: {
    origin: ["https://seu-frontend.railway.app"],
    methods: ["GET", "POST"]
  }
});
```

**Erro de migração:**
```bash
railway run node -e "require('./database/init').initDatabase()"
```

**Logs de erro:**
```bash
railway logs --tail
```

### 10. Checklist de Deploy

- [ ] Código commitado no GitHub
- [ ] Variáveis de ambiente configuradas
- [ ] PostgreSQL adicionado ao projeto
- [ ] Build do frontend funcionando
- [ ] CORS configurado com URL de produção
- [ ] Email SMTP configurado
- [ ] Admin criado
- [ ] Testes básicos funcionando

### 11. Custos

Railway oferece:
- **Plano Hobby:** $5/mês por serviço (backend + frontend + db = $15/mês)
- **Plano Trial:** $5 grátis para testar

### 12. Monitoramento

- **Logs:** Railway Dashboard → Deployments → Logs
- **Métricas:** CPU, Memória, Network no dashboard
- **Alerts:** Configurar via webhooks

---

## 🔧 Configuração Adicional

### Webhook para Auto-Deploy
Railway faz auto-deploy ao detectar push no branch main/master.

### Custom Domain
No Railway Dashboard:
1. Settings → Domains
2. Add Custom Domain
3. Configure DNS conforme instruções

### Backup do Banco
```bash
railway run pg_dump $DATABASE_URL > backup.sql
```

---

## 📞 Suporte

Em caso de problemas:
1. Verificar logs: `railway logs`
2. Verificar status: `railway status`
3. Discord do Railway: https://discord.gg/railway
