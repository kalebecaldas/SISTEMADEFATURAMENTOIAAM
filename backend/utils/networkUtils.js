const os = require('os');

/**
 * Obtém o IP da rede local da máquina
 * @returns {string} IP da rede local ou 'localhost' se não encontrar
 */
function getLocalNetworkIP() {
  const interfaces = os.networkInterfaces();
  
  // Priorizar IPv4
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Ignorar loopback e IPv6
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  
  return 'localhost';
}

/**
 * Obtém a URL do frontend, priorizando configuração do banco/env
 * Se não configurado, usa IP da rede local
 */
function getFrontendURL() {
  // Se tiver FRONTEND_URL configurado, usar
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }
  
  // Se não tiver, tentar detectar IP local
  const localIP = getLocalNetworkIP();
  const port = process.env.FRONTEND_PORT || '5173';
  
  return `http://${localIP}:${port}`;
}

module.exports = {
  getLocalNetworkIP,
  getFrontendURL
};

