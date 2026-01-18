# ✅ Checklist de Deploy - Railway

## 📋 Antes do Deploy

- [ ] Código commitado e pushed para o GitHub
- [ ] Arquivos `railway.json` criados (backend e frontend)
- [ ] Arquivo `.env.example` no frontend criado
- [ ] Build do frontend testado localmente (`npm run build`)
- [ ] Conta no Railway criada (https://railway.app)

## 🗄️ Configuração do PostgreSQL

- [ ] PostgreSQL adicionado ao projeto Railway
- [ ] Variável `DATABASE_URL` criada automaticamente

## ⚙️ Configuração do Backend

### Variáveis de Ambiente:
- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET=<gere_um_segredo_forte>`
- [ ] `EMAIL_HOST=smtp.gmail.com`
- [ ] `EMAIL_PORT=587`
- [ ] `EMAIL_USER=<seu_email@gmail.com>`
- [ ] `EMAIL_PASS=<senha_de_app_do_gmail>`
- [ ] `EMAIL_FROM=noreply@sistema.com`
- [ ] `FRONTEND_URL=<url_frontend_railway>` ⚠️ Preencher após deploy do frontend

### Verificação:
- [ ] Deploy do backend concluído sem erros
- [ ] Logs mostram: "✅ Tabela usuarios criada"
- [ ] Logs mostram: "✅ Admin customizado criado"
- [ ] Endpoint raiz funciona: `https://seu-backend.up.railway.app`
- [ ] Retorna JSON com status: "running"

## 🎨 Configuração do Frontend

### Variáveis de Ambiente:
- [ ] `VITE_API_URL=<url_backend_railway>/api` ⚠️ NÃO esquecer o `/api`

### Verificação:
- [ ] Build do frontend concluído sem erros
- [ ] Tela de login carrega corretamente
- [ ] Sem erros no console do navegador

## 🔗 Conectar Frontend e Backend

- [ ] `FRONTEND_URL` atualizada no backend com URL do frontend
- [ ] Redeploy do backend feito
- [ ] `VITE_API_URL` no frontend aponta para backend correto
- [ ] Teste de CORS funcionando

## ✅ Testes Finais

- [ ] Login funciona com:
  - Email: kalebe.caldas@hotmail.com
  - Senha: mxskqgltne
- [ ] Dashboard carrega sem erros
- [ ] Consegue cadastrar novo colaborador
- [ ] Upload de planilha funciona
- [ ] Email de teste enviado com sucesso

## 🔒 Segurança (Antes de Produção)

- [ ] Alterar senha do usuário master
- [ ] Remover rota `/api/create-admin-now` do server.js (linhas 166-205)
- [ ] Gerar `JWT_SECRET` forte e único
- [ ] Configurar senha de app do Gmail (não usar senha normal)
- [ ] Revisar e limpar variáveis de ambiente

## 📊 Configurações Adicionais (Opcional)

- [ ] Domínio customizado configurado
- [ ] Backup automático do banco configurado
- [ ] Monitoring/alertas configurados
- [ ] Logs estruturados revisados

## 🐛 Troubleshooting

Se algo der errado, verifique:

1. **Erro de CORS:**
   - [ ] `FRONTEND_URL` no backend está correta?
   - [ ] URL não tem barra `/` no final?

2. **Frontend não conecta:**
   - [ ] `VITE_API_URL` tem `/api` no final?
   - [ ] Backend está acessível?
   - [ ] Testar URL do backend no navegador

3. **Tabelas não criadas:**
   - [ ] Ver logs do backend
   - [ ] Procurar mensagens de erro do PostgreSQL
   - [ ] Executar manualmente: `railway run node -e "require('./database/init').initDatabase()"`

4. **Usuário não foi criado:**
   - [ ] Acessar: `https://seu-backend.up.railway.app/api/create-admin-now`
   - [ ] Ou via CLI: `railway run node setup-admin.js`

## 📝 URLs de Referência

**Produção:**
- Backend: ___________________________________
- Frontend: ___________________________________
- PostgreSQL: (interno - não público)

**Desenvolvimento:**
- Backend: http://localhost:5001
- Frontend: http://localhost:5173

---

## 🎯 Ordem Recomendada de Deploy

1. ✅ Criar projeto no Railway
2. ✅ Adicionar PostgreSQL
3. ✅ Deploy do Backend (com variáveis)
4. ✅ Verificar logs e criação de tabelas
5. ✅ Deploy do Frontend (com VITE_API_URL)
6. ✅ Atualizar FRONTEND_URL no backend
7. ✅ Testar login e funcionalidades
8. ✅ Configurar segurança
9. ✅ Domínio customizado (opcional)

---

**Última atualização:** {{ data_atual }}
**Status:** 🟢 Pronto para deploy
