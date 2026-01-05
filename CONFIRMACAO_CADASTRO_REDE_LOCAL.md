# 🔗 Confirmação de Cadastro em Rede Local

## ✅ Status do Sistema

**O status fica "ativo" automaticamente quando o prestador confirma o cadastro!**

Quando o prestador clica no link do email e define sua senha, o sistema:
1. ✅ Atualiza o status de `pendente` para `ativo` (linha 225 do `auth.js`)
2. ✅ Define a senha do prestador
3. ✅ Remove o token de confirmação
4. ✅ Registra a data de confirmação

---

## 📧 Como Funciona o Email de Confirmação

### 1. **Criação do Prestador (Admin)**
- Admin cria o prestador na página de Prestadores
- Sistema gera um token único de confirmação
- Sistema cria o prestador com status `pendente`
- Sistema envia email com link de confirmação

### 2. **Link no Email**
O link no email é gerado assim:
```
{FRONTEND_URL}/confirmar-cadastro?token={token_aleatorio}
```

### 3. **Prioridade da URL do Frontend**
O sistema usa a URL nesta ordem:
1. **Configuração no banco de dados** (`frontend_url` na tabela `configuracoes`)
2. **Variável de ambiente** (`FRONTEND_URL` no `.env`)
3. **Detecção automática** (IP da rede local + porta 5173)

---

## 🌐 Funcionamento em Rede Local

### Cenário 1: Mesmo Computador
- ✅ Funciona perfeitamente
- Link: `http://localhost:5173/confirmar-cadastro?token=...`
- Prestador clica → abre no navegador → define senha → status vira `ativo`

### Cenário 2: Mesma Rede Local (Outro Dispositivo)
- ✅ Funciona se configurado corretamente
- Link precisa usar o **IP da máquina servidor**, não `localhost`
- Exemplo: `http://192.168.1.100:5173/confirmar-cadastro?token=...`

---

## ⚙️ Configuração para Rede Local

### Opção 1: Configurar Manualmente (Recomendado)

1. **Descobrir o IP da sua máquina:**
   ```bash
   # No Mac/Linux:
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # No Windows:
   ipconfig
   ```
   Procure por algo como: `192.168.1.100` ou `10.0.0.5`

2. **Configurar na página de Settings:**
   - Acesse `/settings` como admin
   - Na seção "Configurações de Email"
   - Preencha o campo "URL do Frontend"
   - Exemplo: `http://192.168.1.100:5173`
   - Clique em "Salvar"

3. **Garantir que o frontend está acessível:**
   - O Vite precisa estar rodando com `--host` para aceitar conexões externas
   - Ou use: `npm run dev -- --host`

### Opção 2: Detecção Automática

Se você **não configurar** a URL do frontend:
- O sistema detecta automaticamente o IP da rede local
- Usa esse IP + porta 5173
- **Funciona na maioria dos casos**, mas pode não ser o IP correto se houver múltiplas interfaces de rede

---

## 🔍 O Que Acontece Quando Ela Clica no Link?

### Passo a Passo:

1. **Email recebido** ✅
   - Prestador recebe email no Gmail (ou outro serviço configurado)
   - Email contém link: `http://IP:5173/confirmar-cadastro?token=abc123...`

2. **Clica no link** ✅
   - Abre a página de confirmação no navegador
   - Sistema extrai o token da URL

3. **Define a senha** ✅
   - Prestador preenche senha e confirma
   - Sistema envia para: `POST /api/auth/confirm-registration`

4. **Backend processa** ✅
   - Valida o token
   - Hash da senha
   - **Atualiza status para `ativo`** ← AQUI!
   - Remove token de confirmação
   - Registra data de confirmação

5. **Sucesso** ✅
   - Mensagem: "Cadastro confirmado com sucesso!"
   - Redireciona para `/login` após 3 segundos
   - Prestador pode fazer login normalmente

---

## 🛠️ Troubleshooting

### Problema: Link não abre
**Causa:** URL está usando `localhost` mas prestador está em outro dispositivo

**Solução:**
1. Configure o IP correto na página de Settings
2. Ou use detecção automática (deixe campo vazio)

### Problema: "Token inválido ou expirado"
**Causas possíveis:**
- Token já foi usado (prestador já confirmou)
- Token expirou (se houver expiração implementada)
- Token incorreto (cópia/colagem errada)

**Solução:** Admin pode reenviar email de confirmação

### Problema: Não consegue acessar de outro dispositivo
**Causa:** Frontend não está acessível na rede

**Solução:**
1. Verifique firewall (porta 5173 deve estar aberta)
2. Rode Vite com `--host`: `npm run dev -- --host`
3. Use o IP correto da máquina servidor

### Problema: Email não chega
**Causas:**
- Configuração de email incorreta
- Email caiu em spam
- Servidor de email bloqueou

**Solução:**
1. Teste conexão na página de Settings
2. Verifique pasta de spam
3. Use App Password para Gmail

---

## 📝 Exemplo Prático

### Configuração Completa:

1. **Máquina Servidor (Mac):**
   - IP: `192.168.1.100`
   - Backend: `http://192.168.1.100:5001`
   - Frontend: `http://192.168.1.100:5173`

2. **Configuração no Settings:**
   ```
   URL do Frontend: http://192.168.1.100:5173
   ```

3. **Email enviado:**
   ```
   Link: http://192.168.1.100:5173/confirmar-cadastro?token=abc123...
   ```

4. **Prestador (outro dispositivo na mesma rede):**
   - Recebe email
   - Clica no link
   - Abre `http://192.168.1.100:5173/confirmar-cadastro?token=abc123...`
   - Define senha
   - Status vira `ativo` ✅

---

## ✅ Checklist

- [ ] Gmail/Email configurado e testado
- [ ] URL do Frontend configurada (ou detecção automática ativa)
- [ ] Frontend acessível na rede (Vite com `--host` se necessário)
- [ ] Firewall permite porta 5173
- [ ] Prestador recebe email
- [ ] Link funciona ao clicar
- [ ] Página de confirmação carrega
- [ ] Senha definida com sucesso
- [ ] Status muda para `ativo` automaticamente

---

## 🔐 Segurança

- Token é único e aleatório (32 bytes)
- Token é removido após uso (não pode ser reutilizado)
- Senha é hasheada com bcrypt antes de salvar
- Status só muda de `pendente` para `ativo` após confirmação
- Prestador não pode fazer login até confirmar cadastro

---

**Última atualização:** Dezembro 2025

