#!/bin/bash

# Ativa o ambiente virtual Python se existir
if [ -f "venv/bin/activate" ]; then
  source venv/bin/activate
fi

# Matar processos nas portas 5001 e 3001 (macOS)
lsof -ti:5001 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Inicia backend e frontend em paralelo
cd backend && npm run dev &
BACK_PID=$!

# Inicia o frontend premium (pasta correta)
cd "../frontend-premium" && npm run dev &
FRONT_PID=$!

# Espera ambos terminarem
wait $BACK_PID
wait $FRONT_PID 