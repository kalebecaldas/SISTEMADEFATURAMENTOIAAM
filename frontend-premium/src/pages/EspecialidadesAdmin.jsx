import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X, AlertCircle, Info, TrendingUp, Zap, BookOpen } from 'lucide-react';
import api from '../services/api';

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = v => `${Number(v || 0).toFixed(1)}%`;

// ─── helpers inline ───────────────────────────────────────────────────────────
const UNIDADES = ['MATRIZ', 'ANEXO', 'SÃO JOSÉ'];

const Badge = ({ children, color = '#6366f1' }) => (
  <span style={{
    display: 'inline-block', padding: '2px 8px', borderRadius: 20,
    fontSize: '0.65rem', fontWeight: 700,
    background: `${color}22`, color,
  }}>{children}</span>
);

const Pill = ({ on }) => (
  <span style={{
    display: 'inline-block', padding: '2px 10px', borderRadius: 20,
    fontSize: '0.65rem', fontWeight: 700,
    background: on ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.1)',
    color: on ? '#22c55e' : '#ef4444',
  }}>{on ? 'Ativo' : 'Inativo'}</span>
);

const inp = {
  width: '100%', padding: '0.45rem 0.65rem', borderRadius: 8,
  border: '1px solid var(--border-color, #444)',
  background: 'var(--bg-input, #1a1a2e)', color: 'inherit', fontSize: '0.85rem',
};

// ─── Modal genérico ───────────────────────────────────────────────────────────
const Modal = ({ title, subtitle, onClose, children }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }} onClick={onClose}>
    <div style={{
      background: 'var(--bg-card, #1a1a2e)', borderRadius: 16, padding: '2rem',
      width: '100%', maxWidth: 560, border: '1px solid var(--border-color, #2d2d3f)',
      boxShadow: '0 25px 60px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto',
    }} onClick={e => e.stopPropagation()}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{title}</h3>
        {subtitle && <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  </div>
);

// ─── Modal PJ ─────────────────────────────────────────────────────────────────
const ModalPJ = ({ item, onClose, onSalvo }) => {
  const isNew = !item?.id;
  const [form, setForm] = useState({
    especialidade: item?.especialidade || '',
    unidade: item?.unidade || 'MATRIZ',
    pct_sem_meta: item?.pct_sem_meta ?? '',
    pct_com_meta: item?.pct_com_meta ?? '',
    meta_mensal: item?.meta_mensal != null ? String(item.meta_mensal) : '',
    valor_fixo_base: item?.valor_fixo_base != null && item.valor_fixo_base > 0 ? String(item.valor_fixo_base) : '',
    nao_possui_meta: item && item.meta_mensal == null,
    nao_possui_fixo: !item?.valor_fixo_base || item?.valor_fixo_base === 0,
    ativo: item?.ativo ?? 1,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSalvar = async () => {
    setSalvando(true); setErro('');
    const payload = {
      ...form,
      nao_possui_meta: form.nao_possui_meta,
      nao_possui_fixo: form.nao_possui_fixo,
    };
    try {
      if (isNew) await api.post('/especialidades/pj', payload);
      else await api.put(`/especialidades/pj/${item.id}`, payload);
      onSalvo();
      onClose();
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao salvar');
    } finally { setSalvando(false); }
  };

  const lbl = { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' };

  return (
    <Modal
      title={isNew ? 'Nova especialidade PJ' : 'Editar especialidade PJ'}
      subtitle="Percentuais, meta e fixo por turno"
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <label style={lbl}>
            Especialidade (código)
            <input style={inp} value={form.especialidade} onChange={e => set('especialidade', e.target.value)}
              placeholder="Ex: Fisio, Acup, RPG" />
          </label>
          <label style={lbl}>
            Unidade
            <select style={inp} value={form.unidade} onChange={e => set('unidade', e.target.value)}>
              {UNIDADES.map(u => <option key={u}>{u}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <label style={lbl}>
            Meta mensal (R$)
            <input style={inp} type="number" step="0.01" min="0"
              value={form.meta_mensal} onChange={e => set('meta_mensal', e.target.value)}
              placeholder="Ex: 25000" disabled={form.nao_possui_meta} />
          </label>
          <label style={{ ...lbl, flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '1.4rem' }}>
            <input type="checkbox" checked={form.nao_possui_meta} onChange={e => set('nao_possui_meta', e.target.checked)} />
            Não possui meta
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <label style={lbl}>
            % Sem meta
            <input style={inp} type="number" step="0.1" min="0" max="100"
              value={form.pct_sem_meta} onChange={e => set('pct_sem_meta', e.target.value)}
              placeholder="Ex: 12" />
          </label>
          <label style={lbl}>
            % Com meta
            <input style={inp} type="number" step="0.1" min="0" max="100"
              value={form.pct_com_meta} onChange={e => set('pct_com_meta', e.target.value)}
              placeholder="Ex: 14" />
          </label>
          <label style={lbl}>
            Fixo/turno (R$)
            <input style={inp} type="number" step="0.01" min="0"
              value={form.valor_fixo_base} onChange={e => set('valor_fixo_base', e.target.value)}
              placeholder="600" disabled={form.nao_possui_fixo} />
          </label>
        </div>
        <label style={{ ...lbl, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={form.nao_possui_fixo} onChange={e => set('nao_possui_fixo', e.target.checked)} />
          Não possui fixo
        </label>

        {!isNew && (
          <label style={{ ...lbl, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={!!form.ativo} onChange={e => set('ativo', e.target.checked ? 1 : 0)} />
            Ativo
          </label>
        )}

        <div style={{ padding: '0.75rem', borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <strong style={{ color: '#818cf8' }}>Como funciona:</strong> Faturado clínica (excluindo Particular/OAB) × % aplicado.
          Se meta batida → usa "Com meta", senão → "Sem meta".
          Fixo por turno é somado ao final (descontado R$ 20 por falta).
        </div>

        {erro && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#f87171', fontSize: '0.82rem', background: 'rgba(248,113,113,0.1)', padding: '0.5rem 0.75rem', borderRadius: 8 }}>
            <AlertCircle size={14} /> {erro}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: '1px solid var(--border-color, #444)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSalvar} disabled={salvando} style={{ padding: '0.5rem 1.5rem', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Check size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Modal CLT ────────────────────────────────────────────────────────────────
const ModalCLT = ({ item, onClose, onSalvo }) => {
  const isNew = !item?.id;
  const [form, setForm] = useState({
    especialidade: item?.especialidade || '',
    label: item?.label || '',
    meta_mensal: item?.meta_mensal != null ? String(item.meta_mensal) : '',
    salario_base: item?.salario_base != null ? String(item.salario_base) : '',
    nao_possui_meta: item && item.meta_mensal == null,
    nao_possui_salario: item && (item.salario_base == null || item.salario_base === 0),
    pct_com_meta: item?.pct_com_meta ?? 0,
    pct_meta_extra: item?.pct_meta_extra ?? 0,
    limiar_meta_extra: item?.limiar_meta_extra ?? 0,
    desconto_por_falta: item?.desconto_por_falta ?? 0,
    tem_calculo_automatico: item?.tem_calculo_automatico ?? 1,
    observacoes: item?.observacoes || '',
    ativo: item?.ativo ?? 1,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSalvar = async () => {
    setSalvando(true); setErro('');
    try {
      if (isNew) await api.post('/especialidades/clt', form);
      else await api.put(`/especialidades/clt/${item.id}`, form);
      onSalvo();
      onClose();
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao salvar');
    } finally { setSalvando(false); }
  };

  const lbl = { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' };
  const numInp = (k, placeholder) => (
    <input style={inp} type="number" step="0.01" min="0"
      value={form[k]} onChange={e => set(k, e.target.value)} placeholder={placeholder} />
  );

  return (
    <Modal
      title={isNew ? 'Nova especialidade CLT' : 'Editar especialidade CLT'}
      subtitle="Regras de meta e comissão CLT"
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <label style={lbl}>
            Especialidade (código)
            <input style={inp} value={form.especialidade} onChange={e => set('especialidade', e.target.value)}
              placeholder="Ex: Fisio, Acup, RPG" />
          </label>
          <label style={lbl}>
            Nome completo
            <input style={inp} value={form.label} onChange={e => set('label', e.target.value)}
              placeholder="Ex: Fisioterapia CLT" />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <label style={lbl}>
            Meta mensal (R$)
            <input style={inp} type="number" step="0.01" min="0" value={form.meta_mensal} onChange={e => set('meta_mensal', e.target.value)}
              placeholder="25000" disabled={form.nao_possui_meta} />
          </label>
          <label style={lbl}>
            Salário base (R$)
            <input style={inp} type="number" step="0.01" min="0" value={form.salario_base} onChange={e => set('salario_base', e.target.value)}
              placeholder="3745" disabled={form.nao_possui_salario} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <label style={{ ...lbl, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={form.nao_possui_meta} onChange={e => set('nao_possui_meta', e.target.checked)} />
            Não possui meta
          </label>
          <label style={{ ...lbl, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={form.nao_possui_salario} onChange={e => set('nao_possui_salario', e.target.checked)} />
            Não possui salário base
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <label style={lbl}>
            % Comissão (com meta)
            {numInp('pct_com_meta', '20')}
            <span style={{ fontSize: '0.7rem' }}>Sobre faturado clínica quando meta batida</span>
          </label>
          <label style={lbl}>
            % Comissão extra
            {numInp('pct_meta_extra', '17')}
            <span style={{ fontSize: '0.7rem' }}>% alternativo (abaixo do limiar)</span>
          </label>
        </div>

        <label style={lbl}>
          Limiar para % extra (R$)
          {numInp('limiar_meta_extra', '30000')}
          <span style={{ fontSize: '0.7rem' }}>Se fat. {'<'} limiar → usa % extra (ex: Acupuntura: R$ 30.000 → 17% vs 20%)</span>
        </label>

        <label style={lbl}>
          Desconto por falta (R$)
          {numInp('desconto_por_falta', '0')}
          <span style={{ fontSize: '0.7rem' }}>CLT: geralmente 0 (desconto no salário pelo RH)</span>
        </label>

        <label style={{ ...lbl, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={!!form.tem_calculo_automatico}
            onChange={e => set('tem_calculo_automatico', e.target.checked ? 1 : 0)} />
          Cálculo automático habilitado
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(desabilitar = revisão manual obrigatória)</span>
        </label>

        <label style={lbl}>
          Observações
          <textarea style={{ ...inp, resize: 'vertical', minHeight: 60 }}
            value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
            placeholder="Ex: Regras especiais, exceções..." />
        </label>

        {!isNew && (
          <label style={{ ...lbl, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={!!form.ativo} onChange={e => set('ativo', e.target.checked ? 1 : 0)} />
            Ativo
          </label>
        )}

        {erro && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#f87171', fontSize: '0.82rem', background: 'rgba(248,113,113,0.1)', padding: '0.5rem 0.75rem', borderRadius: 8 }}>
            <AlertCircle size={14} /> {erro}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: '1px solid var(--border-color, #444)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSalvar} disabled={salvando} style={{ padding: '0.5rem 1.5rem', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Check size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Confirmação de exclusão ──────────────────────────────────────────────────
const ConfirmDelete = ({ label, onConfirm, onCancel }) => (
  <Modal title="Excluir especialidade?" onClose={onCancel}>
    <p style={{ marginTop: 0 }}>Tem certeza que deseja excluir <strong>{label}</strong>? Esta ação não pode ser desfeita.</p>
    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
      <button onClick={onCancel} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: '1px solid var(--border-color, #444)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>Cancelar</button>
      <button onClick={onConfirm} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Excluir</button>
    </div>
  </Modal>
);

// ─── Tabela PJ ────────────────────────────────────────────────────────────────
const TabelaPJ = ({ data, onEdit, onDelete }) => {
  const unidades = [...new Set(data.map(r => r.unidade))].sort();

  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border-color, #2d2d3f)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
        <thead>
          <tr style={{ background: 'rgba(99,102,241,0.08)' }}>
            {['Especialidade', 'Unidade', 'Meta (R$)', '% Sem Meta', '% Com Meta', 'Fixo/Turno', 'Status', 'Ações'].map(h => (
              <th key={h} style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color, #2d2d3f)', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={r.id}
              style={{ borderBottom: '1px solid var(--border-color, #2d2d3f)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
            >
              <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>{r.especialidade}</td>
              <td style={{ padding: '0.65rem 0.85rem' }}>
                <Badge color={r.unidade === 'MATRIZ' ? '#6366f1' : r.unidade === 'ANEXO' ? '#f59e0b' : '#22c55e'}>{r.unidade}</Badge>
              </td>
              <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>
                {r.meta_mensal != null && r.meta_mensal > 0 ? (
                  <span style={{ color: '#f59e0b' }}>R$ {fmt(r.meta_mensal)}</span>
                ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>N/P</span>}
              </td>
              <td style={{ padding: '0.65rem 0.85rem', color: '#f59e0b', fontWeight: 600 }}>{fmtPct(r.pct_sem_meta)}</td>
              <td style={{ padding: '0.65rem 0.85rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#22c55e', fontWeight: 700 }}>
                  <TrendingUp size={12} /> {fmtPct(r.pct_com_meta)}
                </span>
              </td>
              <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>
                {r.valor_fixo_base > 0 ? (
                  <span style={{ color: '#818cf8' }}>R$ {fmt(r.valor_fixo_base)}</span>
                ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>N/P</span>}
              </td>
              <td style={{ padding: '0.65rem 0.85rem' }}><Pill on={!!r.ativo} /></td>
              <td style={{ padding: '0.65rem 0.65rem' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => onEdit(r)} title="Editar" style={{ background: 'transparent', border: '1px solid var(--border-color,#444)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.7rem' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color,#444)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                    <Pencil size={11} /> Editar
                  </button>
                  <button onClick={() => onDelete(r)} title="Excluir" style={{ background: 'transparent', border: '1px solid transparent', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.7rem' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Tabela CLT ───────────────────────────────────────────────────────────────
const TabelaCLT = ({ data, onEdit, onDelete }) => (
  <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border-color, #2d2d3f)' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
      <thead>
        <tr style={{ background: 'rgba(34,197,94,0.07)' }}>
          {['Especialidade', 'Meta Mensal', 'Salário Base', '% Com Meta', '% Extra', 'Limiar Extra', 'Automático', 'Status', 'Ações'].map(h => (
            <th key={h} style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color, #2d2d3f)', whiteSpace: 'nowrap' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((r, i) => (
          <tr key={r.id}
            style={{ borderBottom: '1px solid var(--border-color, #2d2d3f)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
          >
            <td style={{ padding: '0.65rem 0.85rem' }}>
              <div style={{ fontWeight: 700 }}>{r.especialidade}</div>
              {r.label && r.label !== r.especialidade && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.label}</div>
              )}
            </td>
            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>
              {r.meta_mensal != null && r.meta_mensal > 0 ? <span style={{ color: '#f59e0b' }}>R$ {fmt(r.meta_mensal)}</span> : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>N/P</span>}
            </td>
            <td style={{ padding: '0.65rem 0.85rem' }}>
              {r.salario_base != null && r.salario_base > 0 ? <span>R$ {fmt(r.salario_base)}</span> : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>N/P</span>}
            </td>
            <td style={{ padding: '0.65rem 0.85rem' }}>
              {r.pct_com_meta > 0 ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#22c55e', fontWeight: 700 }}>
                  <TrendingUp size={12} /> {fmtPct(r.pct_com_meta)}
                </span>
              ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
            </td>
            <td style={{ padding: '0.65rem 0.85rem', color: '#818cf8' }}>
              {r.pct_meta_extra > 0 ? fmtPct(r.pct_meta_extra) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
            </td>
            <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-muted)' }}>
              {r.limiar_meta_extra > 0 ? `R$ ${fmt(r.limiar_meta_extra)}` : '—'}
            </td>
            <td style={{ padding: '0.65rem 0.85rem' }}>
              {r.tem_calculo_automatico ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontWeight: 700, color: '#22c55e' }}>
                  <Zap size={11} /> Auto
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b' }}>
                  <BookOpen size={11} /> Manual
                </span>
              )}
            </td>
            <td style={{ padding: '0.65rem 0.85rem' }}><Pill on={!!r.ativo} /></td>
            <td style={{ padding: '0.65rem 0.65rem' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onEdit(r)} title="Editar" style={{ background: 'transparent', border: '1px solid var(--border-color,#444)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.7rem' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#22c55e'; e.currentTarget.style.color = '#22c55e'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color,#444)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                  <Pencil size={11} /> Editar
                </button>
                <button onClick={() => onDelete(r)} title="Excluir" style={{ background: 'transparent', border: '1px solid transparent', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.7rem' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}>
                  <Trash2 size={11} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Página principal ─────────────────────────────────────────────────────────
export default function EspecialidadesAdmin() {
  const [aba, setAba] = useState('pj');
  const [listaPJ, setListaPJ] = useState([]);
  const [listaCLT, setListaCLT] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalPJ, setModalPJ] = useState(null);    // null = fechado, {} = novo, {...} = editar
  const [modalCLT, setModalCLT] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { tipo, item }
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [pj, clt] = await Promise.all([
        api.get('/especialidades/pj'),
        api.get('/especialidades/clt'),
      ]);
      setListaPJ(pj.data);
      setListaCLT(clt.data);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { tipo, item } = deleteTarget;
    try {
      await api.delete(`/especialidades/${tipo}/${item.id}`);
      showToast('Especialidade excluída');
      carregar();
    } catch { showToast('Erro ao excluir'); }
    setDeleteTarget(null);
  };

  const cardStyle = (ativo) => ({
    padding: '0.5rem 1.25rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
    fontSize: '0.875rem', transition: 'all 0.15s',
    background: ativo ? '#6366f1' : 'transparent',
    color: ativo ? '#fff' : 'var(--text-muted)',
    borderBottom: ativo ? '2px solid #818cf8' : '2px solid transparent',
  });

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>

      {/* Cabeçalho */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Especialidades</h1>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Configure comissões, metas e fixos por tipo de contrato
        </p>
      </div>

      {/* Info banner */}
      <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', padding: '0.9rem 1.1rem', borderRadius: 10, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', marginBottom: '1.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        <Info size={16} style={{ marginTop: 1, color: '#818cf8', flexShrink: 0 }} />
        <div>
          <strong style={{ color: '#818cf8' }}>PJ:</strong> Percentuais de comissão sobre faturamento clínica (excluindo Particular/OAB) + fixo por turno.
          {' '}<strong style={{ color: '#22c55e' }}>CLT:</strong> Comissão baseada em meta e faturamento. Salário base prevalece quando meta não é batida.
          Alterações no <em>Fixo/Turno PJ</em> são propagadas automaticamente para todos os vínculos dessa especialidade.
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color, #2d2d3f)', paddingBottom: '0.1rem' }}>
        <button style={cardStyle(aba === 'pj')} onClick={() => setAba('pj')}>
          PJ — Prestadores ({listaPJ.length})
        </button>
        <button style={cardStyle(aba === 'clt')} onClick={() => setAba('clt')}>
          CLT — Colaboradores ({listaCLT.length})
        </button>
      </div>

      {carregando ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Carregando...</div>
      ) : (
        <>
          {/* Aba PJ */}
          {aba === 'pj' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Comissões PJ por Especialidade</h2>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Percentuais aplicados sobre faturado clínica (excluindo Particular/OAB)
                  </p>
                </div>
                <button
                  onClick={() => setModalPJ({})}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  <Plus size={15} /> Nova especialidade PJ
                </button>
              </div>
              <TabelaPJ data={listaPJ} onEdit={r => setModalPJ(r)} onDelete={r => setDeleteTarget({ tipo: 'pj', item: r })} />

              {/* Resumo visual */}
              <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {[...new Set(listaPJ.map(r => r.especialidade))].sort().map(esp => {
                  const rows = listaPJ.filter(r => r.especialidade === esp);
                  const fixo = rows[0]?.valor_fixo_base || 0;
                  return (
                    <div key={esp} style={{ padding: '1rem', borderRadius: 10, border: '1px solid var(--border-color, #2d2d3f)', background: 'var(--bg-card, #1a1a2e)' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.5rem' }}>{esp}</div>
                      {rows.map(r => (
                        <div key={r.id} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 3 }}>
                          <Badge color={r.unidade === 'MATRIZ' ? '#6366f1' : r.unidade === 'ANEXO' ? '#f59e0b' : '#22c55e'}>{r.unidade}</Badge>
                          {' '}
                          <span style={{ color: '#f59e0b' }}>{fmtPct(r.pct_sem_meta)}</span>
                          {' → '}
                          <span style={{ color: '#22c55e', fontWeight: 700 }}>{fmtPct(r.pct_com_meta)}</span>
                        </div>
                      ))}
                      {fixo > 0 && (
                        <div style={{ marginTop: 6, fontSize: '0.72rem', color: '#818cf8', fontWeight: 700 }}>
                          + R$ {fmt(fixo)}/turno fixo
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aba CLT */}
          {aba === 'clt' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Regras CLT por Especialidade</h2>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Metas, salários e percentuais de comissão para colaboradores CLT
                  </p>
                </div>
                <button
                  onClick={() => setModalCLT({})}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  <Plus size={15} /> Nova especialidade CLT
                </button>
              </div>
              <TabelaCLT data={listaCLT} onEdit={r => setModalCLT(r)} onDelete={r => setDeleteTarget({ tipo: 'clt', item: r })} />

              {/* Legenda cálculo */}
              <div style={{ marginTop: '1.5rem', padding: '1.1rem 1.25rem', borderRadius: 10, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: '#22c55e' }}>Como funciona o cálculo CLT:</strong>
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', lineHeight: 1.8 }}>
                  <li><strong>Com meta batida:</strong> Faturado clínica × % Com Meta (ou % Extra se abaixo do limiar)</li>
                  <li><strong>Sem meta:</strong> max(valor profissional da planilha, salário base)</li>
                  <li><strong>Manual:</strong> Cálculo automático desabilitado → deve ser revisado pelo admin antes de confirmar</li>
                </ul>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modais */}
      {modalPJ !== null && (
        <ModalPJ item={Object.keys(modalPJ).length === 0 ? null : modalPJ} onClose={() => setModalPJ(null)}
          onSalvo={() => { carregar(); showToast('Especialidade PJ salva!'); }} />
      )}
      {modalCLT !== null && (
        <ModalCLT item={Object.keys(modalCLT).length === 0 ? null : modalCLT} onClose={() => setModalCLT(null)}
          onSalvo={() => { carregar(); showToast('Especialidade CLT salva!'); }} />
      )}
      {deleteTarget && (
        <ConfirmDelete
          label={`${deleteTarget.item.especialidade}${deleteTarget.item.unidade ? ' — ' + deleteTarget.item.unidade : ''}`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 10000,
          padding: '0.75rem 1.25rem', borderRadius: 10, background: '#1e293b',
          border: '1px solid #334155', color: '#fff', fontWeight: 600,
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <Check size={14} style={{ color: '#22c55e' }} /> {toast}
        </div>
      )}
    </div>
  );
}
