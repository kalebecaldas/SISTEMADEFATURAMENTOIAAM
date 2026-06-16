/**
 * Cadastro rápido de prestador + vínculo (mesma regra de POST /api/atendimentos/prestadores/cadastro-rapido).
 * Reutilizado pelo fluxo de upload de planilha mensal.
 */
const bcrypt = require('bcryptjs');
const { db } = require('../database/init');

/**
 * @param {object} params
 * @param {string} params.nome
 * @param {string} [params.email]
 * @param {string} [params.especialidade]
 * @param {string} [params.unidade]
 * @param {string} [params.turno]
 * @param {string} [params.tipo_contrato]
 * @param {number|null} [params.meta_mensal]
 * @param {number|null} [params.valor_fixo_base]
 */
async function cadastrarPrestadorRapido(params) {
  const {
    nome,
    email,
    especialidade = 'Fisio',
    unidade = 'MATRIZ',
    turno = 'INDEFINIDO',
    tipo_contrato = 'prestador',
    meta_mensal = null,
    valor_fixo_base = null,
  } = params;

  if (!nome || !String(nome).trim()) {
    throw new Error('Nome é obrigatório');
  }

  const emailFinal = email || `${nome.toLowerCase().replace(/\s+/g, '.')}@cadastro-rapido.local`;

  let usuario = await db('usuarios').where('email', emailFinal.trim()).first();

  if (!usuario) {
    const senhaTemp = Math.random().toString(36).slice(-8);
    const senhaHash = bcrypt.hashSync(senhaTemp, 10);

    const insertResult = await db('usuarios').insert({
      nome: nome.trim(),
      email: emailFinal.trim(),
      senha: senhaHash,
      tipo: 'prestador',
      tipo_colaborador: tipo_contrato === 'clt' ? 'clt' : 'pj',
      ativo: true,
      cadastro_confirmado: true,
    }).returning('id');

    let newUserId = Array.isArray(insertResult) ? insertResult[0] : insertResult;
    if (newUserId && typeof newUserId === 'object' && newUserId.id != null) {
      newUserId = newUserId.id;
    }
    usuario = await db('usuarios').where('id', newUserId).first();
  }

  const vinculoInsert = await db('prestador_vinculos').insert({
    prestador_id: usuario.id,
    tipo_contrato,
    especialidade,
    unidade,
    turno,
    meta_mensal: meta_mensal != null ? parseFloat(meta_mensal) : null,
    valor_fixo_base: valor_fixo_base != null ? parseFloat(valor_fixo_base) : null,
    desconto_por_falta: 20,
    ativo: true,
  }).returning('id');

  let vinculoId = Array.isArray(vinculoInsert) ? vinculoInsert[0] : vinculoInsert;
  if (vinculoId && typeof vinculoId === 'object' && vinculoId.id != null) {
    vinculoId = vinculoId.id;
  }

  return {
    sucesso: true,
    prestador_id: usuario.id,
    vinculo_id: vinculoId,
    nome: usuario.nome,
    especialidade,
    unidade,
    turno,
    tipo_contrato,
  };
}

module.exports = {
  cadastrarPrestadorRapido,
};
