# Sistema de Faturamento para Prestadores de Serviços

Sistema web completo para gestão de prestadores de serviços, com dashboard, histórico de dados e controle de notas fiscais.

## 🚀 Funcionalidades

### ✅ Fase 1 - Sistema Web Básico
- **Backend Node.js** com Express e SQLite
- **Frontend React** com Material-UI
- **Autenticação JWT** para admin e prestadores
- **Upload de planilhas Excel** com processamento automático
- **Dashboard** para prestadores e administradores
- **Histórico** de dados processados
- **Upload de notas fiscais** (PDF)
- **Gestão de prestadores** (admin)
- **Relatórios** (admin)

### ✅ Melhorias Mobile-First Implementadas
- **WebSockets** para notificações em tempo real
- **PWA (Progressive Web App)** com cache offline
- **API otimizada** para mobile com paginação
- **Sistema de notificações** nativas
- **Endpoints RESTful** melhorados
- **Service Worker** para funcionalidade offline
- **Layout responsivo** com navegação por tabs
- **Componentes mobile-friendly** (MobileCard, MobileList)
- **Interface adaptativa** (desktop/mobile)
- **Navegação inferior** para mobile
- **Pull-to-refresh** em listas
- **Touch-friendly** com botões maiores

### Para Prestadores:
- 📊 **Dashboard** com resumo mensal
- 📈 **Histórico** de dados por mês
- 📄 **Notas Fiscais** (upload/download)
- 📱 **Interface responsiva**
- 🔔 **Notificações em tempo real**

### Para Administradores:
- 👥 **Gestão de prestadores**
- 📊 **Dashboard executivo**
- 📈 **Relatórios detalhados**
- 📤 **Upload de planilhas Excel**
- 🔔 **Notificações de uploads**

## 🛠️ Tecnologias

- **Backend**: Node.js, Express, SQLite, Socket.io
- **Frontend**: React, Material-UI, Socket.io-client
- **Autenticação**: JWT
- **Upload**: Multer
- **Planilhas**: XLSX
- **PWA**: Service Worker
- **Notificações**: WebSockets + Push API

## 📦 Instalação

### Pré-requisitos
- Node.js 16+
- npm ou yarn

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## 🔐 Acesso

### Admin Padrão
- **Email**: admin@sistema.com
- **Senha**: admin123

### Prestadores
- **Email**: email da planilha
- **Senha**: 123456 (padrão)

## 📋 Como Usar

### 1. Iniciar o Sistema
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

### 2. Acessar o Sistema
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

### 3. Fazer Login
- Use as credenciais do admin ou prestador
- O sistema redirecionará automaticamente

### 4. Upload de Planilha (Admin)
1. Faça login como admin
2. Vá para "Upload Planilha"
3. Selecione mês/ano
4. Faça upload da planilha Excel
5. O sistema processará automaticamente

### 5. Visualizar Dados (Prestador)
1. Faça login com email da planilha
2. Acesse o dashboard
3. Veja histórico por mês
4. Gerencie notas fiscais

## 📊 Estrutura da Planilha

O sistema espera uma planilha Excel com:
- **Aba**: "ABRIL" (configurável)
- **Coluna A**: Nomes dos funcionários
- **Coluna K**: Faltas
- **Coluna L**: Emails
- **Coluna T**: Valor líquido

## 🔧 Configuração

### Variáveis de Ambiente (Backend)
```env
PORT=5000
JWT_SECRET=sua_chave_secreta
NODE_ENV=development
```

### Configurações do Sistema
- Meta padrão: R$ 5.000,00
- Prazo nota fiscal: 15 dias
- Senha padrão prestadores: 123456

## 📁 Estrutura do Projeto

```
SISTEMA DE FATURAMENTO/
├── backend/
│   ├── routes/
│   ├── middleware/
│   ├── database/
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── contexts/
│   └── package.json
└── README.md
```

## 🚧 Próximas Versões

### Fase 2 - Funcionalidades Avançadas
- 📧 Notificações automáticas por email
- 📊 Relatórios executivos detalhados
- 🔄 Sincronização em tempo real
- 📸 Upload por câmera (PWA)
- 📱 Instalação como app nativo
- 🔔 Push notifications nativas

### Fase 3 - Integrações
- 📧 Integração com sistemas de email
- 📊 Exportação para Excel/PDF
- 🔗 API pública para integrações
- 📱 App nativo (opcional)

## 🐛 Suporte

Para problemas ou dúvidas:
1. Verifique os logs do console
2. Confirme se o backend está rodando
3. Verifique as credenciais de acesso
4. Confirme a estrutura da planilha

## 📄 Licença

Este projeto é de uso interno para gestão de prestadores de serviços. 