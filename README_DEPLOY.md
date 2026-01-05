# 🚀 Guia de Deploy no Railway (PostgreSQL)

Este sistema já está configurado para rodar no Railway com banco de dados PostgreSQL.

## 1. Preparação no Railway

1. Crie uma conta no [Railway.app](https://railway.app/)
2. Crie um "New Project" > "Provision PostgreSQL"
3. Isso criará um banco de dados PostgreSQL para você.

## 2. Configuração do Backend

1. No seu projeto Railway, clique em "New" > "GitHub Repo" e conecte este repositório.
2. Selecione a pasta `backend` como "Root Directory" nas configurações do serviço (se você subir o monorepo todo).
   - *Dica:* Se possível, mantenha backend e frontend em repositórios separados ou configure o "Root Directory" corretamente.
3. Vá na aba **Variables** do seu serviço backend no Railway e adicione:
   - `PORT`: `5001` (ou deixe o Railway definir, mas o código espera 5001 ou env var)
   - `JWT_SECRET`: Crie uma senha forte
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: (O Railway geralmente injeta isso automaticamente quando você conecta o PostgreSQL, verifique se a variável existe)

## 3. Configuração do Frontend

1. O frontend deve ser buildado (`npm run build`).
2. Para deploy estático (Vercel/Netlify é recomendado para React + Vite):
   - Configure a variável de ambiente `VITE_API_URL` para a URL do seu backend no Railway (ex: `https://seu-backend.up.railway.app/api`).
   - No arquivo `src/services/api.js`, certifique-se de que ele usa essa variável:
     ```javascript
     baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api'
     ```

## 4. Banco de Dados

O sistema usa **Knex.js** e foi refatorado para ser agnóstico.
- Em **Desenvolvimento**: Usa SQLite (`sistema_faturamento.db`)
- Em **Produção** (quando `NODE_ENV=production`): Usa PostgreSQL via `DATABASE_URL`.

As tabelas serão criadas automaticamente na primeira inicialização graças ao script `initDatabase`.

## 📝 Comandos Úteis

- **Rodar localmente (SQLite):**
  ```bash
  npm run dev
  ```

- **Rodar em produção:**
  ```bash
  npm start
  ```
