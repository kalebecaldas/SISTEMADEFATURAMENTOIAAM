import React, { useState, useCallback } from 'react';
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown, UserCheck, X } from 'lucide-react';
import api from '../services/api';

const fmt = (v) =>
  v == null
    ? '—'
    : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtPct = (v) => (v == null ? '—' : `${Number(v).toFixed(0)}%`);

// ---------- Badge CLT / PJ ----------
const BadgeTipoContrato = ({ tipo }) => {
  const isClt = tipo === 'clt';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.2rem',
        padding: '2px 7px',
        borderRadius: '9999px',
        fontSize: '0.68rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        background: isClt ? '#dcfce7' : '#dbeafe',
        color: isClt ? '#15803d' : '#1d4ed8',
        border: `1px solid ${isClt ? '#86efac' : '#93c5fd'}`,
        whiteSpace: 'nowrap',
      }}
    >
      {isClt ? 'CLT' : 'PJ'}
    </span>
  );
};

// ---------- Modal Tornar CLT ----------
const ModalTornarCLT = ({ item, onClose, onConvertido }) => {
  const [form, setForm] = useState({
    especialidade: item.especialidade || 'Fisio',
    unidade: item.unidade || 'MATRIZ',
    turno: item.turno || 'INDEFINIDO',
    meta_mensal: '',
    valor_fixo_base: '',
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    try {
      const res = await api.post(`/atendimentos/prestadores/${item.prestador_id}/tornar-clt`, {
        especialidade: form.especialidade,
        unidade: form.unidade,
        turno: form.turno,
        meta_mensal: form.meta_mensal ? parseFloat(form.meta_mensal) : null,
        valor_fixo_base: form.valor_fixo_base ? parseFloat(form.valor_fixo_base) : null,
      });
      onConvertido(item, res.data);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao converter para CLT');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'var(--bg-card, #1e1e2e)',
          border: '1px solid var(--border-color, #2d2d3f)',
          borderRadius: 16,
          padding: '1.75rem',
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserCheck size={18} style={{ color: '#22c55e' }} />
            Converter para CLT — {item.nome}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem' }}>
            Especialidade
            <select name="especialidade" value={form.especialidade} onChange={handleChange}
              style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-color, #444)', background: 'var(--bg-input, #2a2a3e)', color: 'inherit' }}>
              <option value="Fisio">Fisioterapia</option>
              <option value="Acupuntura">Acupuntura</option>
              <option value="Neuro">Neurologia</option>
              <option value="RPG">RPG</option>
              <option value="Pilates">Pilates</option>
              <option value="Fisio Pelv">Fisio Pélvica</option>
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem' }}>
            Unidade
            <select name="unidade" value={form.unidade} onChange={handleChange}
              style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-color, #444)', background: 'var(--bg-input, #2a2a3e)', color: 'inherit' }}>
              <option value="MATRIZ">Matriz (Vieiralves)</option>
              <option value="ANEXO">Anexo</option>
              <option value="SÃO JOSÉ">São José</option>
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem' }}>
            Turno
            <select name="turno" value={form.turno} onChange={handleChange}
              style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-color, #444)', background: 'var(--bg-input, #2a2a3e)', color: 'inherit' }}>
              <option value="MANHÃ">Manhã</option>
              <option value="TARDE">Tarde</option>
              <option value="INDEFINIDO">Indefinido</option>
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem' }}>
              Valor Fixo (R$)
              <input
                type="number" name="valor_fixo_base" value={form.valor_fixo_base}
                onChange={handleChange} placeholder="ex: 3745" min="0" step="0.01"
                style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-color, #444)', background: 'var(--bg-input, #2a2a3e)', color: 'inherit' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem' }}>
              Meta Mensal (R$)
              <input
                type="number" name="meta_mensal" value={form.meta_mensal}
                onChange={handleChange} placeholder="ex: 25000" min="0" step="100"
                style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-color, #444)', background: 'var(--bg-input, #2a2a3e)', color: 'inherit' }}
              />
            </label>
          </div>

          {erro && (
            <div style={{ color: '#f87171', fontSize: '0.82rem', padding: '0.5rem', background: 'rgba(248,113,113,0.1)', borderRadius: 8 }}>
              {erro}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
            <button type="button" onClick={onClose}
              style={{ padding: '0.5rem 1.1rem', borderRadius: 8, border: '1px solid var(--border-color, #444)', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '0.85rem' }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: loading ? 0.7 : 1 }}>
              {loading ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <UserCheck size={14} />}
              {loading ? 'Convertendo...' : 'Tornar CLT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------- Componente Principal ----------

/**
 * TabelaPreviewCalculo
 *
 * Tabela interativa de cálculos por profissional.
 * Exibe badge CLT/PJ por profissional.
 * Permite "Tornar CLT" para profissionais PJ.
 * Permite editar faltas, extras e (para revisão manual) o valor_bruto.
 */
const TabelaPreviewCalculo = ({ itens, onChange }) => {
  const [loading, setLoading] = useState({});
  const [modalItem, setModalItem] = useState(null);

  const recalcular = useCallback(async (idx, novoItem) => {
    setLoading(prev => ({ ...prev, [idx]: true }));
    try {
      // tipo_contrato vem no próprio item — sem necessidade de passá-lo separado
      const res = await api.post('/atendimentos/recalcular', { item: novoItem });
      const atualizado = res.data.item;
      const novos = itens.map((it, i) => (i === idx ? atualizado : it));
      onChange(novos);
    } catch (err) {
      console.error('Erro ao recalcular:', err);
    } finally {
      setLoading(prev => ({ ...prev, [idx]: false }));
    }
  }, [itens, onChange]);

  const handleFaltasChange = (idx, val) => {
    const faltas = Math.max(0, parseInt(val) || 0);
    const novo = { ...itens[idx], faltas };
    recalcular(idx, novo);
  };

  const handleExtrasChange = (idx, val) => {
    const extras = Math.max(0, parseFloat(val) || 0);
    const novo = { ...itens[idx], extras };
    recalcular(idx, novo);
  };

  const handleValorBrutoManual = (idx, val) => {
    const valor = parseFloat(String(val).replace(',', '.')) || 0;
    const novos = itens.map((it, i) => i === idx ? { ...it, valor_bruto: valor } : it);
    onChange(novos);
  };

  // Após converter para CLT, atualiza o item na lista e recalcula
  const handleConvertido = async (itemOriginal, resultado) => {
    setModalItem(null);
    const idx = itens.findIndex(it => it.prestador_id === itemOriginal.prestador_id && it.vinculo_id === itemOriginal.vinculo_id);
    if (idx === -1) return;

    // Atualizar tipo_contrato do item e recalcular
    const itemAtualizado = { ...itens[idx], tipo_contrato: 'clt', vinculo_id: resultado.vinculo_id };
    await recalcular(idx, itemAtualizado);
  };

  // Fat Clínica = soma total (inclui Part/OAB); valor_clinica_meta (sem Part/OAB) é só para checar meta
  const totalValorClinica = itens.reduce((s, i) => s + ((i.valor_clinica_total ?? i.valor_clinica) || 0), 0);
  const totalValorBruto   = itens.reduce((s, i) => s + (i.valor_bruto || 0), 0);
  const totalCLT = itens.filter(i => i.tipo_contrato === 'clt').length;
  const totalPJ  = itens.filter(i => i.tipo_contrato !== 'clt').length;

  return (
    <>
      {/* Legenda rápida */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span><BadgeTipoContrato tipo="clt" /> {totalCLT} profissional(is) CLT</span>
        <span><BadgeTipoContrato tipo="pj" /> {totalPJ} profissional(is) PJ</span>
      </div>

      <div className="preview-table-wrap">
        <table className="preview-table">
          <thead>
            <tr>
              <th>Profissional</th>
              <th>Especialidade</th>
              <th>Unidade / Turno</th>
              <th>Faturado Clínica</th>
              <th>Meta</th>
              <th>Bateu</th>
              <th>%</th>
              <th>Fixo</th>
              <th>Faltas</th>
              <th>Extras</th>
              <th>Valor Final</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, idx) => (
              <tr key={idx} className={item.revisao_manual ? 'revisao-manual' : ''}>
                {/* Nome + badge CLT/PJ + botão Tornar CLT */}
                <td style={{ minWidth: 160 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.nome}</span>
                    <BadgeTipoContrato tipo={item.tipo_contrato} />
                  </div>
                  {item.nome_planilha !== item.nome && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      planilha: {item.nome_planilha}
                    </div>
                  )}
                  {item.tipo_contrato !== 'clt' && (
                    <button
                      onClick={() => setModalItem(item)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                        marginTop: '0.25rem', padding: '1px 6px', borderRadius: 5,
                        background: 'transparent', border: '1px solid #22c55e',
                        color: '#22c55e', fontSize: '0.62rem', fontWeight: 600,
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      title="Converter para CLT"
                    >
                      <UserCheck size={9} /> Tornar CLT
                    </button>
                  )}
                </td>

                {/* Especialidade */}
                <td style={{ fontSize: '0.82rem' }}>
                  <div>{item.especialidade || '—'}</div>
                  {item.especialidade_comissao && item.especialidade_comissao !== item.especialidade && (
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {item.especialidade_comissao}
                    </div>
                  )}
                </td>

                {/* Unidade + Turno agrupados */}
                <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                  <div>{item.unidade || '—'}</div>
                  <span className="badge-tipo" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>{item.turno}</span>
                </td>

              {/* Fat Clínica (soma Col M, inclui Part/OAB) */}
              <td style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{fmt((item.valor_clinica_total ?? item.valor_clinica) || 0)}</td>

              {/* Meta */}
              <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{item.meta_mensal ? fmt(item.meta_mensal) : <span style={{ color: 'var(--text-muted)' }}>N/P</span>}</td>

              {/* Meta batida */}
              <td>
                {item.meta_mensal ? (
                  <span className={`badge-meta ${item.meta_batida ? 'sim' : 'nao'}`} style={{ fontSize: '0.68rem', padding: '2px 5px' }}>
                    {item.meta_batida ? <><TrendingUp size={10} /> META</> : <><TrendingDown size={10} /> FORA</>}
                  </span>
                ) : '—'}
              </td>

              {/* % comissão */}
              <td style={{ fontSize: '0.82rem' }}>{fmtPct(item.pct_aplicado)}</td>

              {/* Fixo ajustado — mostra badge de 2T quando profissional trabalhou 2 turnos */}
              <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                {item.fixo_ajustado > 0 ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {fmt(item.fixo_ajustado)}
                    {item.num_turnos > 1 && (
                      <span title={`${item.num_turnos} turnos × ${item.valor_fixo_base ? fmt(item.valor_fixo_base) : ''}`}
                        style={{ fontSize: '0.62rem', background: 'rgba(139,92,246,0.2)', color: '#a78bfa', borderRadius: 4, padding: '1px 4px', fontWeight: 700 }}>
                        ×{item.num_turnos}T
                      </span>
                    )}
                  </span>
                ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
              </td>

                {/* Faltas (editável) */}
                <td>
                  <input
                    type="number"
                    className="preview-number-input"
                    value={item.faltas || 0}
                    min="0"
                    max="30"
                    onChange={e => handleFaltasChange(idx, e.target.value)}
                    disabled={loading[idx]}
                  />
                </td>

                {/* Extras (editável) */}
                <td>
                  <input
                    type="number"
                    className="preview-number-input"
                    value={item.extras || 0}
                    min="0"
                    step="0.01"
                    onChange={e => handleExtrasChange(idx, e.target.value)}
                    disabled={loading[idx]}
                  />
                </td>

                {/* Valor Final */}
                <td className="valor-bruto-cell">
                  {item.revisao_manual ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <span className="badge-revisao">
                        <AlertTriangle size={11} /> Revisão Manual
                      </span>
                      <input
                        type="number"
                        className="valor-bruto-input"
                        placeholder="0,00"
                        defaultValue={item.valor_bruto != null ? item.valor_bruto : ''}
                        min="0"
                        step="0.01"
                        onBlur={e => handleValorBrutoManual(idx, e.target.value)}
                      />
                    </div>
                  ) : (
                    <span style={{ color: item.valor_bruto > 0 ? '#22c55e' : 'var(--text-muted)' }}>
                      {fmt(item.valor_bruto)}
                    </span>
                  )}
                </td>

                {/* Loading indicator */}
                <td style={{ width: 24 }}>
                  {loading[idx] && (
                    <RefreshCw size={14} className="cp-spinner" style={{ animation: 'spin 0.8s linear infinite' }} />
                  )}
                </td>
              </tr>
            ))}

            {/* Linha de totais */}
            <tr className="total-row">
              <td colSpan={3}>TOTAL ({itens.length} profissional(is))</td>
              <td style={{ color: '#3b82f6', whiteSpace: 'nowrap' }}>{fmt(totalValorClinica)}</td>
              <td colSpan={5}></td>
              <td style={{ color: '#22c55e', whiteSpace: 'nowrap' }}>{fmt(totalValorBruto)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Modal Tornar CLT */}
      {modalItem && (
        <ModalTornarCLT
          item={modalItem}
          onClose={() => setModalItem(null)}
          onConvertido={handleConvertido}
        />
      )}
    </>
  );
};

export default TabelaPreviewCalculo;
