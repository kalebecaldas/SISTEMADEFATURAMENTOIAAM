#!/bin/bash

# Script de preparação para deploy no Railway
# Execute: chmod +x prepare-deploy.sh && ./prepare-deploy.sh

echo "🚀 Preparando projeto para deploy no Railway..."

# 1. Gerar JWT_SECRET
echo ""
echo "1️⃣ Gerando JWT_SECRET..."
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "   JWT_SECRET gerado: $JWT_SECRET"
echo "   ⚠️  COPIE E SALVE este valor para usar no Railway!"

# 2. Testar build do frontend
echo ""
echo "2️⃣ Testando build do frontend..."
cd frontend-premium
if npm run build; then
    echo "   ✅ Build do frontend OK!"
else
    echo " ❌ Erro no build do frontend"
    exit 1
fi
cd ..

# 3. Verificar dependências do backend
echo ""
echo "3️⃣ Verificando dependências do backend..."
cd backend
if npm install --production; then
    echo "   ✅ Dependências do backend OK!"
else
    echo "   ❌ Erro nas dependências do backend"
    exit 1
fi
cd ..

# 4. Verificar arquivos necessários
echo ""
echo "4️⃣ Verificando arquivos de configuração..."
FILES=("backend/railway.json" "backend/.env.example" "DEPLOY_RAILWAY.md" "DEPLOY_RAPIDO.md")
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file não encontrado!"
    fi
done

echo ""
echo "✅ Preparação concluída!"
echo ""
echo "📋 Próximos passos:"
echo "1. Crie um repositório no GitHub"
echo "2. Faça commit e push:"
echo "   git init"
echo "   git add ."
echo "   git commit -m 'Preparando para deploy'"
echo "   git remote add origin <sua-url-do-github>"
echo "   git push -u origin main"
echo ""
echo "3. Acesse: https://railway.app/new"
echo "4. Deploy from GitHub repo"
echo "5. Configure as variáveis de ambiente (use o JWT_SECRET gerado acima)"
echo ""
echo "📚 Para mais detalhes, leia:"
echo "   - DEPLOY_RAPIDO.md (guia passo a passo)"
echo "   - DEPLOY_RAILWAY.md (documentação completa)"
