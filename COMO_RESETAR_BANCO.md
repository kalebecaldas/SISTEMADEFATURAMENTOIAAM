# 🔄 Guia: Como Resetar o Banco de Dados no Railway

## ⚠️ ATENÇÃO
Este processo **APAGA TODOS OS DADOS** do banco e recria do zero!
Use apenas quando realmente necessário.

---

## 🎯 Quando Usar?

- ✅ Quando a senha do master/admin está errada
- ✅ Quando o banco está com estrutura corrompida
- ✅ Para começar do zero em desenvolvimento
- ❌ **NUNCA** em produção com dados reais!

---

## 🚀 Como Resetar (Via Railway)

### Passo 1: Ativar a Flag de Reset

1. Acesse o **Railway**
2. Vá no serviço **Backend**
3. Clique em **Variables**
4. Adicione uma **nova variável**:
   ```
   RESET_DATABASE=true
   ```
5. Clique em **Add**

### Passo 2: Fazer Redeploy

1. No Railway, ainda no **Backend**
2. Clique na aba **Deployments**
3. Clique em **Redeploy** (ou aguarde o redeploy automático)

### Passo 3: Aguardar o Reset

O deploy vai:
1. ✅ Detectar a flag `RESET_DATABASE=true`
2. ⚠️ Apagar todas as tabelas
3. 📦 Recriar todas as tabelas
4. 👥 Criar usuários padrão com senhas corretas:
   - **Admin:** `admin@sistema.com` / `admin123`
   - **Master:** `kalebe.caldas@hotmail.com` / `mxskqgltne`

### Passo 4: Ver os Logs (Importante!)

1. Clique em **View Logs**
2. Você verá:
   ```
   ⚠️  FLAG DE RESET DETECTADA!
   🗑️  Apagando tabelas existentes...
   📦 Recriando estrutura do banco...
   👥 Recriando usuários padrão...
   ✅ RESET COMPLETO!
   ```

### Passo 5: REMOVER A FLAG! ⚠️

**MUITO IMPORTANTE!** Após o reset completar:

1. Volte em **Variables**
2. **DELETE** a variável `RESET_DATABASE`
3. Ou altere para: `RESET_DATABASE=false`

**Se não remover, o banco vai resetar toda vez que o servidor reiniciar!**

---

## 🖥️ Como Resetar (Localmente)

Para testar localmente antes de fazer no Railway:

```bash
cd backend
node reset-database.js
```

Isso vai resetar o SQLite local.

---

## 🔐 Credenciais Após Reset

Sempre que resetar o banco, estes usuários são criados:

### Admin
- **Email:** `admin@sistema.com`
- **Senha:** `admin123`
- **Tipo:** admin

### Master  
- **Email:** `kalebe.caldas@hotmail.com`
- **Senha:** `mxskqgltne`
- **Tipo:** master

---

## 📋 Checklist de Segurança

Antes de resetar em produção:

- [ ] Fazer backup do banco atual (se tiver dados importantes)
- [ ] Confirmar que todos sabem que os dados serão perdidos
- [ ] Ter as credenciais novas anotadas
- [ ] Preparar para recriar dados necessários manualmente

Após resetar:

- [ ] Testar login com admin
- [ ] Testar login com master
- [ ] **REMOVER** a flag `RESET_DATABASE`
- [ ] Verificar que as tabelas foram criadas

---

## 🐛 Troubleshooting

### "O banco não resetou"
- Verifique se a variável está exatamente: `RESET_DATABASE=true` (case sensitive)
- Verifique os logs do deploy

### "Deu erro ao resetar"
- Veja os logs completos
- Pode ser problema de permissão no PostgreSQL
- Tente novamente

### "Esqueci de remover a flag"
- Não entre em pânico!
- Entre no Railway → Variables
- Delete `RESET_DATABASE` ou mude para `false`
- O próximo restart não vai resetar

---

## 💡 Dicas

- **Desenvolvimento:** Pode usar localmente sem medo (`node reset-database.js`)
- **Produção:** Só use se realmente necessário
- **Backup:** Antes de resetar em produção, faça backup:
  ```bash
  railway run pg_dump $DATABASE_URL > backup.sql
  ```

---

## 🆘 Emergência: Preciso Restaurar!

Se resetou sem querer e tinha dados importantes:

1. **Restaurar do backup:**
   ```bash
   railway run psql $DATABASE_URL < backup.sql
   ```

2. **Se não tem backup:**
   - Infelizmente os dados foram perdidos 😞
   - Por isso sempre faça backup antes!

---

## ✅ Resumo Rápido

**Para resetar agora:**
```
1. Railway → Backend → Variables
2. Adicionar: RESET_DATABASE=true
3. Aguardar redeploy
4. Ver logs
5. REMOVER a variável!
6. Logar com: admin@sistema.com / admin123
```

**Pronto!** 🎉
