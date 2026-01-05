#!/bin/bash

# Matar processos nas portas 5001 e 5173
lsof -ti:5001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Inicia backend
echo "Iniciando Backend..."
cd backend && npm run dev &
BACK_PID=$!

# Inicia Frontend Premium
echo "Iniciando Frontend Premium..."
cd frontend-premium && npm run dev &
FRONT_PID=$!

# Espera ambos terminarem
wait $BACK_PID
wait $FRONT_PID
