#!/bin/bash

# Script para preparar o projeto para deploy no Railway
# Execute antes de fazer o deploy

echo "🚀 Preparando projeto para deploy no Railway..."
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar se está na raiz do projeto
if [ ! -f "backend/package.json" ] || [ ! -f "frontend-premium/package.json" ]; then
    echo -e "${RED}❌ Erro: Execute este script na raiz do projeto${NC}"
    exit 1
fi

echo "📋 Checklist de Deploy"
echo "====================="
echo ""

# 1. Verificar Git
echo -n "1. Verificando se o código está commitado... "
if git diff-index --quiet HEAD --; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠${NC}"
    echo -e "${YELLOW}   Você tem alterações não commitadas!${NC}"
    echo "   Commit pendente:"
    git status --short
    echo ""
fi

# 2. Verificar arquivos necessários
echo -n "2. Verificando railway.json do backend... "
if [ -f "backend/railway.json" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

echo -n "3. Verificando railway.json do frontend... "
if [ -f "frontend-premium/railway.json" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# 3. Verificar dependências
echo -n "4. Verificando dependências do backend... "
cd backend
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠ Instalando...${NC}"
    npm install > /dev/null 2>&1
    echo -e "${GREEN}✓${NC}"
fi
cd ..

echo -n "5. Verificando dependências do frontend... "
cd frontend-premium
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠ Instalando...${NC}"
    npm install > /dev/null 2>&1
    echo -e "${GREEN}✓${NC}"
fi
cd ..

# 4. Testar build do frontend
echo -n "6. Testando build do frontend... "
cd frontend-premium
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Erro no build!${NC}"
fi
cd ..

echo ""
echo "📝 Informações Importantes"
echo "=========================="
echo ""

# Mostrar dados do usuário master
echo -e "${YELLOW}👤 Usuário Master (criado automaticamente no deploy):${NC}"
echo "   Email: kalebe.caldas@hotmail.com"
echo "   Senha: mxskqgltne"
echo ""

# Mostrar variáveis de ambiente necessárias
echo -e "${YELLOW}🔐 Variáveis de Ambiente Necessárias:${NC}"
echo ""
echo "BACKEND:"
echo "  NODE_ENV=production"
echo "  JWT_SECRET=<gere_um_segredo_forte>"
echo "  EMAIL_HOST=smtp.gmail.com"
echo "  EMAIL_PORT=587"
echo "  EMAIL_USER=<seu_email>"
echo "  EMAIL_PASS=<senha_app_gmail>"
echo "  EMAIL_FROM=noreply@sistema.com"
echo "  FRONTEND_URL=<url_do_frontend_no_railway>"
echo ""
echo "FRONTEND:"
echo "  VITE_API_URL=<url_do_backend_no_railway>/api"
echo ""

echo -e "${GREEN}✅ Preparação concluída!${NC}"
echo ""
echo "📚 Próximos passos:"
echo "   1. Commit e push do código (se necessário)"
echo "   2. Acesse https://railway.app/new"
echo "   3. Siga o guia em GUIA_DEPLOY_RAILWAY.md"
echo ""
echo "   Ou use Railway CLI:"
echo "   $ npm install -g @railway/cli"
echo "   $ railway login"
echo "   $ railway init"
echo "   $ railway up"
echo ""
