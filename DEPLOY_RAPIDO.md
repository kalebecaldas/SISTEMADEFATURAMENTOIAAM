# Deploy Rápido - Passo a Passo

## 🚀 Opção 1: Deploy Completo (Backend + Frontend Separados)

### Passo 1: Preparar Repositório GitHub

```bash
cd "/Users/kalebecaldas/Downloads/SISTEMA DE FATURAMENTO"

# Inicializar git (se ainda não foi)
git init
git add .
git commit -m "Preparando para deploy no Railway"

# Criar repositório no GitHub e fazer push
git remote add origin https://github.com/seu-usuario/sistema-faturamento.git
git push -u origin main
```

### Passo 2: Deploy do Backend no Railway

1. **Acesse:** https://railway.app/new
2. **Clique:** "Deploy from GitHub repo"
3. **Selecione:** seu repositório
4. **Configure Root Directory:** `backend`
5. **Adicione PostgreSQL:**
   - Clique em "+ New"
   - Selecione "Database" → "PostgreSQL"
6. **Configure Variáveis de Ambiente:**
   ```
   NODE_ENV=production
   JWT_SECRET=cole_um_secret_forte_aqui_min_32_chars
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=seu_email@gmail.com
   EMAIL_PASS=sua_senha_app
   EMAIL_FROM=noreply@sistema.com
   FRONTEND_URL=https://seu-frontend.railway.app
   ```
7. **Deploy automático acontecerá!**

### Passo 3: Deploy do Frontend no Railway

1. **No mesmo projeto Railway, clique:** "+ New"
2. **Selecione:** "GitHub Repo" (mesmo repositório)
3. **Configure Root Directory:** `frontend-premium`
4. **Adicione Variável de Ambiente:**
   ```
   VITE_API_URL=https://seu-backend.railway.app
   ```
5. **Deploy automático!**

### Passo 4: Pós-Deploy

```bash
# Criar usuário admin via Railway CLI
railway run --service backend node create_admin.js

# Ou acesse: https://seu-backend.railway.app
# O sistema cria admin automaticamente na inicialização
```

---

## ⚡ Opção 2: Deploy Rápido (Backend servindo Frontend)

### Passo 1: Build do Frontend

```bash
cd frontend-premium
npm install
VITE_API_URL=https://seu-backend.railway.app npm run build
```

### Passo 2: Copiar build para backend

```bash
cp -r dist ../backend/public
```

### Passo 3: Atualizar server.js

Adicione antes das rotas API:

```javascript
// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, 'public')));

// Todas as rotas não-API retornam o index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
```

### Passo 4: Deploy no Railway

1. Apenas 1 serviço (backend)
2. Railway faz deploy
3. Acesse: https://seu-backend.railway.app

---

## 🔑 Gerar JWT_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado e use como `JWT_SECRET`

---

## 📧 Configurar Email Gmail

1. **Habilitar verificação em 2 etapas** na sua conta Google
2. **Criar senha de app:**
   - Acesse: https://myaccount.google.com/apppasswords
   - Gere uma senha
   - Use essa senha em `EMAIL_PASS`

---

## ✅ Checklist Pré-Deploy

- [ ] PostgreSQL adicionado ao projeto Railway
- [ ] Todas variáveis de ambiente configuradas
- [ ] `JWT_SECRET` gerado (min 32 caracteres)
- [ ] Email SMTP configurado e testado
- [ ] CORS configurado com URL de produção

---

## 🐛 Troubleshooting

### Erro: "Cannot connect to database"
- Verifique se PostgreSQL foi adicionado
- Confirme que `DATABASE_URL` existe nas variáveis

### Erro: "CORS policy"
- Adicione URL do frontend em `FRONTEND_URL`
- Reinicie o serviço backend

### Erro: "Email sending failed"
- Verifique credenciais SMTP
- Teste com: `GET https://seu-backend.railway.app/api/test-email`

### Ver logs em tempo real:
```bash
railway logs --tail
```

---

## 📊 Monitorar Aplicação

- **Logs:** Railway Dashboard → Deployments → Logs
- **Métricas:** CPU, RAM, Network
- **Database:** Railway → PostgreSQL → Data

---

## 💰 Custos Estimados

**Railway Hobby Plan:**
- Backend: ~$5/mês
- Frontend (opcional): ~$5/mês  
- PostgreSQL: Incluso
- **Total:** $5-10/mês

**Trial:** $5 grátis para começar

---

## 🔄 Atualizações Futuras

Toda vez que fizer `git push`:
- Railway detecta mudanças
- Rebuild e redeploy automáticos
- Zero downtime

---

## 🎯 URLs Finais

Após deploy completo:
- **API:** `https://sistema-faturamento-production-abcd.up.railway.app`
- **Frontend:** `https://sistema-faturamento-frontend-xyz.up.railway.app`
- **Admin:** admin@sistema.com / admin123

---

## 📞 Suporte

- **Railway Docs:** https://docs.railway.app
- **Discord:** https://discord.gg/railway
- **Status:** https://railway.app/status
