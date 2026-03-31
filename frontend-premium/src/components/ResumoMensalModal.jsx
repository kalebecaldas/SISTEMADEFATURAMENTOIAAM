import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Users, Briefcase, DollarSign, FileDown, FileSpreadsheet, Pencil, Check, AlertCircle } from 'lucide-react';
import api from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const fmt = (v) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ---------- Modal de edição de registro ----------
const ESPECIALIDADES_COM_FIXO_PJ = ['RPG', 'Fisio', 'Acupuntura', 'Neuro', 'Acup', 'SJFisio', 'SJAcup', 'SJRPG'];
const ehPJComFixo = (reg) => reg.tipo_colaborador !== 'clt' && ESPECIALIDADES_COM_FIXO_PJ.includes(reg.especialidade);
const r2 = (v) => Math.round((parseFloat(v) || 0) * 100) / 100;

const ModalEdicaoRegistro = ({ registro, onClose, onSalvo }) => {
  const temFixo = ehPJComFixo(registro);
  const metaBatida = !!registro.meta_batida;
  const fixoBase = r2(registro.valor_fixo ?? (temFixo ? 600 : 0));

  // comissao_base = porção do valor_bruto que vem da % (sem fixo, sem extras)
  // Tanto com meta batida quanto sem meta, o fixo está embutido no valor_bruto → subtrai sempre
  const comissaoBase = r2((registro.valor_bruto || 0) - fixoBase - (registro.extras || 0));

  const [faltas, setFaltas] = useState(registro.faltas ?? 0);
  const [fixo, setFixo] = useState(fixoBase);
  const [extras, setExtras] = useState(r2(registro.extras || 0));
  const [valorClinica, setValorClinica] = useState(r2(registro.valor_clinica ?? 0));
  const [valorBruto, setValorBruto] = useState(r2(registro.valor_bruto ?? 0));
  const [obs, setObs] = useState(registro.observacoes_edicao ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [brutoManual, setBrutoManual] = useState(false);

  const DESCONTO_POR_FALTA = 20; // R$ 20 por falta (600/30)

  // Recalcula valor_bruto automaticamente quando faltas/fixo/extras mudam (PJ com fixo)
  useEffect(() => {
    if (!temFixo || brutoManual) return;
    const faltasN = parseInt(faltas) || 0;
    const fixoN = r2(fixo);
    const extrasN = r2(extras);
    const desconto = faltasN * DESCONTO_POR_FALTA;
    const fixoAjustado = Math.max(0, fixoN - desconto);
    const novo = r2(Math.max(0, comissaoBase + fixoAjustado + extrasN));
    setValorBruto(novo);
  }, [faltas, fixo, extras, temFixo, brutoManual]);

  const handleSalvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    const faltasN = parseInt(faltas) || 0;
    const fixoN = r2(fixo);
    const extrasN = r2(extras);
    const desconto = faltasN * DESCONTO_POR_FALTA;
    const fixoAjustado = Math.max(0, fixoN - desconto);
    try {
      await api.put(`/dados-mensais/${registro.id}`, {
        valor_clinica: r2(valorClinica),
        faltas: faltasN,
        valor_fixo: temFixo ? fixoAjustado : undefined,
        extras: extrasN || undefined,
        valor_bruto: r2(valorBruto),
        observacoes_edicao: obs || null,
      });
      onSalvo();
      onClose();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const inp = {
    width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8,
    border: '1px solid var(--border-color, #444)',
    background: 'var(--bg-input, #1a1a2e)', color: 'inherit',
    fontSize: '0.9rem',
  };
  const lbl = { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.82rem', color: 'var(--text-muted)' };

  const faltasN = parseInt(faltas) || 0;
  const fixoN = r2(fixo);
  const desconto = faltasN * DESCONTO_POR_FALTA;
  const fixoAjustado = Math.max(0, fixoN - desconto);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card, #1a1a2e)', borderRadius: 16,
        padding: '2rem', width: '100%', maxWidth: 500,
        border: '1px solid var(--border-color, #2d2d3f)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Editar Registro</h3>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {registro.nome} · {registro.especialidade} · {registro.turno}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSalvar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Linha 1: Faturado + Faltas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label style={lbl}>
              Faturado Clínica (R$)
              <input type="text" inputMode="decimal" value={valorClinica}
                onChange={e => setValorClinica(e.target.value)}
                onBlur={e => setValorClinica(r2(e.target.value))}
                style={inp} />
            </label>
            <label style={lbl}>
              Faltas
              <input type="number" value={faltas} min="0" max="31" step="1"
                onChange={e => setFaltas(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                style={inp} />
            </label>
          </div>

          {/* Fixo + Extras (só PJ com fixo) */}
          {temFixo && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <label style={lbl}>
                Fixo base (R$)
                <input type="text" inputMode="decimal" value={fixo}
                  onChange={e => setFixo(e.target.value)}
                  onBlur={e => setFixo(r2(e.target.value))}
                  style={inp} placeholder="600" />
                {desconto > 0 && (
                  <span style={{ fontSize: '0.7rem', color: '#f87171' }}>
                    −R$ {desconto.toFixed(2)} ({faltasN} falta{faltasN > 1 ? 's' : ''} × R$ {DESCONTO_POR_FALTA}) → fixo ajustado: R$ {fixoAjustado.toFixed(2)}
                  </span>
                )}
              </label>
              <label style={lbl}>
                Extras (R$)
                <input type="text" inputMode="decimal" value={extras}
                  onChange={e => setExtras(e.target.value)}
                  onBlur={e => setExtras(r2(e.target.value))}
                  style={inp} placeholder="0" />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Dias extras em outro turno
                </span>
              </label>
            </div>
          )}

          {/* Valor Bruto — calculado automaticamente ou manual */}
          <label style={lbl}>
            Valor Final a Pagar (R$)
            {temFixo && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                {brutoManual ? '✏️ Editado manualmente' : '🔄 Calculado automaticamente'} ·{' '}
                <button type="button" onClick={() => setBrutoManual(!brutoManual)}
                  style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }}>
                  {brutoManual ? 'usar automático' : 'editar manualmente'}
                </button>
              </span>
            )}
            <input type="text" inputMode="decimal" value={valorBruto}
              onChange={e => { setBrutoManual(true); setValorBruto(e.target.value); }}
              onBlur={e => setValorBruto(r2(e.target.value))}
              style={{ ...inp, background: brutoManual ? 'rgba(99,102,241,0.1)' : inp.background }} />
          </label>

          <label style={lbl}>
            Observação (opcional)
            <input type="text" value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Ex: Ajuste manual de faturamento" style={inp} />
          </label>

          {erro && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#f87171', fontSize: '0.82rem', background: 'rgba(248,113,113,0.1)', padding: '0.5rem 0.75rem', borderRadius: 8 }}>
              <AlertCircle size={14} /> {erro}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} style={{
              padding: '0.5rem 1.25rem', borderRadius: 8,
              border: '1px solid var(--border-color, #444)', background: 'transparent',
              color: 'inherit', cursor: 'pointer', fontSize: '0.875rem',
            }}>Cancelar</button>
            <button type="submit" disabled={salvando} style={{
              padding: '0.5rem 1.5rem', borderRadius: 8, border: 'none',
              background: '#6366f1', color: '#fff', fontWeight: 600,
              cursor: salvando ? 'not-allowed' : 'pointer', fontSize: '0.875rem',
              opacity: salvando ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}>
              <Check size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------- Tabela de profissionais ----------
const TabelaResumo = ({ registros, tipo, onEditar }) => {
  const isClt = tipo === 'clt';
  const totalCli = registros.reduce((s, r) => s + (r.valor_clinica || 0), 0);
  const totalExtras = registros.reduce((s, r) => s + (r.extras || 0), 0);
  const totalBruto = registros.reduce((s, r) => s + (r.valor_bruto || 0), 0);

  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border-color, #2d2d3f)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: 700 }}>
        <thead>
          <tr style={{ background: isClt ? 'rgba(34,197,94,0.08)' : 'rgba(59,130,246,0.08)' }}>
            {['Profissional', 'Especialidade', 'Unidade', 'Turno', 'Fat. Clínica', 'Meta', 'Bateu?', 'Fixo', 'Faltas', 'Extras', 'Valor Bruto', ''].map(h => (
              <th key={h} style={{
                padding: '0.6rem 0.75rem',
                textAlign: 'left',
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border-color, #2d2d3f)',
                whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {registros.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border-color, #2d2d3f)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {r.nome}
                  {r.foi_editado ? (
                    <span title="Editado manualmente" style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: 4, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', fontWeight: 700 }}>✎</span>
                  ) : null}
                </div>
              </td>
              <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)' }}>{r.especialidade || '—'}</td>
              <td style={{ padding: '0.6rem 0.75rem' }}>{r.unidade || '—'}</td>
              <td style={{ padding: '0.6rem 0.75rem' }}>
                <span style={{
                  display: 'inline-block', padding: '2px 6px', borderRadius: 20,
                  fontSize: '0.65rem', fontWeight: 700,
                  background: 'rgba(59,130,246,0.12)', color: '#3b82f6',
                }}>{r.turno || '—'}</span>
              </td>
              <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>{fmt(r.valor_clinica)}</td>
              <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)' }}>{r.meta_mensal ? fmt(r.meta_mensal) : 'N/P'}</td>
              <td style={{ padding: '0.6rem 0.75rem' }}>
                {r.meta_mensal ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '2px 6px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700,
                    background: r.meta_batida ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
                    color: r.meta_batida ? '#16a34a' : '#dc2626',
                  }}>
                    {r.meta_batida ? <><TrendingUp size={10} /> META</> : <><TrendingDown size={10} /> FORA</>}
                  </span>
                ) : '—'}
              </td>
              <td style={{ padding: '0.6rem 0.75rem' }}>{r.valor_fixo > 0 ? fmt(r.valor_fixo) : '—'}</td>
              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                {r.faltas > 0 ? (
                  <span style={{ color: '#f87171', fontWeight: 600 }}>{r.faltas}</span>
                ) : <span style={{ color: 'var(--text-muted)' }}>0</span>}
              </td>
              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                {r.extras > 0 ? (
                  <span style={{ color: '#34d399', fontWeight: 600 }}>{fmt(r.extras)}</span>
                ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
              </td>
              <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#22c55e' }}>{fmt(r.valor_bruto)}</td>
              <td style={{ padding: '0.6rem 0.5rem' }}>
                <button
                  onClick={() => onEditar(r)}
                  title="Editar registro"
                  style={{
                    background: 'transparent', border: '1px solid var(--border-color, #444)',
                    borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                    color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: '0.7rem', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color, #444)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <Pencil size={11} /> Editar
                </button>
              </td>
            </tr>
          ))}

          {/* Linha de totais */}
          <tr style={{ background: 'rgba(255,255,255,0.03)', borderTop: '2px solid var(--border-color, #2d2d3f)' }}>
            <td colSpan={4} style={{ padding: '0.6rem 0.75rem', fontWeight: 700, fontSize: '0.8rem' }}>
              TOTAL — {registros.length} profissional(is)
            </td>
            <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#3b82f6' }}>{fmt(totalCli)}</td>
            <td colSpan={3}></td>
            <td></td>
            <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#34d399' }}>
              {totalExtras > 0 ? fmt(totalExtras) : '—'}
            </td>
            <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#22c55e' }}>{fmt(totalBruto)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// ---------- Colunas e formatação compartilhadas ----------
const COLS = ['Profissional', 'Especialidade', 'Unidade', 'Turno', 'Fat. Clínica', 'Meta', 'Bateu?', 'Fixo', 'Faltas', 'Extras', 'Valor Bruto'];

const registroParaLinha = (r) => [
  r.nome,
  r.especialidade || '—',
  r.unidade || '—',
  r.turno || '—',
  Number(r.valor_clinica || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
  r.meta_mensal ? Number(r.meta_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : 'N/P',
  r.meta_mensal ? (r.meta_batida ? 'META ✓' : 'FORA') : '—',
  r.valor_fixo > 0 ? Number(r.valor_fixo).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—',
  String(r.faltas || 0),
  r.extras > 0 ? Number(r.extras).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—',
  Number(r.valor_bruto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
];

const linhaTotal = (lista) => [
  `TOTAL (${lista.length} profissional(is))`, '', '', '',
  Number(lista.reduce((s, r) => s + (r.valor_clinica || 0), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
  '', '', '', '',
  Number(lista.reduce((s, r) => s + (r.extras || 0), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
  Number(lista.reduce((s, r) => s + (r.valor_bruto || 0), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
];

// ---------- Exportar PDF ----------
function exportarPDF(data, nomeMes, ano) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const titulo = `Resumo de Pagamentos — ${nomeMes} ${ano}`;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, 14, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, 25);

  let posY = 32;

  const adicionarSecao = (label, registros, cor) => {
    if (registros.length === 0) return;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...cor);
    doc.text(label, 14, posY);
    doc.setTextColor(0, 0, 0);
    posY += 5;

    const rows = registros.map(registroParaLinha);
    rows.push(linhaTotal(registros));

    autoTable(doc, {
      startY: posY,
      head: [COLS],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: cor, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      didParseCell: (data) => {
        // Linha de total em negrito
        if (data.row.index === rows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [230, 230, 240];
        }
        // Colorir META / FORA
        if (data.column.index === 6 && data.section === 'body') {
          if (data.cell.raw === 'META ✓') data.cell.styles.textColor = [22, 163, 74];
          if (data.cell.raw === 'FORA') data.cell.styles.textColor = [220, 38, 38];
        }
      },
    });

    posY = doc.lastAutoTable.finalY + 10;
  };

  if (data.clt.quantidade > 0) adicionarSecao('CLT — Contratos Trabalhistas', data.clt.registros, [34, 139, 34]);
  if (data.pj.quantidade > 0) adicionarSecao('PJ — Prestadores de Serviço', data.pj.registros, [29, 78, 216]);

  // Rodapé de totais
  if (posY < 180) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const totalClt = data.clt.total_valor_bruto;
    const totalPj = data.pj.total_valor_bruto;
    const totalGeral = data.total_geral;
    const linhas = [];
    if (data.clt.quantidade > 0) linhas.push(`CLT: ${Number(totalClt).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
    if (data.pj.quantidade > 0) linhas.push(`PJ: ${Number(totalPj).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
    linhas.push(`Total Geral: ${Number(totalGeral).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
    doc.text(linhas.join('   |   '), 14, posY);
  }

  doc.save(`Resumo_${nomeMes}_${ano}.pdf`);
}

// ---------- Exportar Excel ----------
function exportarExcel(data, nomeMes, ano) {
  const wb = XLSX.utils.book_new();

  const adicionarAba = (label, registros, tipo) => {
    if (registros.length === 0) return;

    const headerInfo = [
      [`Resumo de Pagamentos — ${nomeMes} ${ano}`],
      [tipo === 'clt' ? 'CLT — Contratos Trabalhistas' : 'PJ — Prestadores de Serviço'],
      [`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`],
      [],
    ];

    const linhas = registros.map(registroParaLinha);
    linhas.push(linhaTotal(registros));

    const wsData = [...headerInfo, COLS, ...linhas];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Larguras das colunas
    ws['!cols'] = [22, 14, 10, 8, 14, 14, 7, 12, 6, 14].map(w => ({ wch: w }));

    // Estilo da célula de título (apenas para planilhas com suporte)
    const nomeAba = tipo === 'clt' ? 'CLT' : 'PJ';
    XLSX.utils.book_append_sheet(wb, ws, nomeAba);
  };

  // Aba combinada
  if (data.clt.quantidade > 0 && data.pj.quantidade > 0) {
    const combinado = [
      [`Resumo Completo — ${nomeMes} ${ano}`],
      [`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`],
      [],
      ['--- CLT — Contratos Trabalhistas ---'],
      COLS,
      ...data.clt.registros.map(registroParaLinha),
      linhaTotal(data.clt.registros),
      [],
      ['--- PJ — Prestadores de Serviço ---'],
      COLS,
      ...data.pj.registros.map(registroParaLinha),
      linhaTotal(data.pj.registros),
      [],
      [`Total Geral:`, '', '', '', '', '', '', '', '', Number(data.total_geral).toLocaleString('pt-BR', { minimumFractionDigits: 2 })],
    ];
    const wsCombo = XLSX.utils.aoa_to_sheet(combinado);
    wsCombo['!cols'] = [22, 14, 10, 8, 14, 14, 7, 12, 6, 14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wsCombo, 'Completo');
  }

  adicionarAba('CLT', data.clt.registros, 'clt');
  adicionarAba('PJ', data.pj.registros, 'pj');

  XLSX.writeFile(wb, `Resumo_${nomeMes}_${ano}.xlsx`);
}

// ---------- Modal Principal ----------
const ResumoMensalModal = ({ mes, ano, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState('ambos'); // 'clt' | 'pj' | 'ambos'
  const [registroEditando, setRegistroEditando] = useState(null);

  const carregar = async () => {
    setLoading(true);
    setErro('');
    try {
      const res = await api.get(`/dados-mensais/resumo/${mes}/${ano}`);
      setData(res.data);
      if (res.data.clt.quantidade > 0 && res.data.pj.quantidade > 0) setAba('ambos');
      else if (res.data.clt.quantidade > 0) setAba('clt');
      else setAba('pj');
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [mes, ano]);

  const nomeMes = MESES[mes] || mes;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '2rem 1rem',
        overflowY: 'auto',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--bg-card, #1a1a2e)',
        border: '1px solid var(--border-color, #2d2d3f)',
        borderRadius: 20,
        width: '100%',
        maxWidth: 1100,
        boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1.5rem 2rem',
          borderBottom: '1px solid var(--border-color, #2d2d3f)',
          background: 'var(--glass-bg, rgba(255,255,255,0.03))',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={20} style={{ color: '#0066FF' }} />
              Resumo — {nomeMes} {ano}
            </h2>
            {data && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {data.clt.quantidade} CLT · {data.pj.quantidade} PJ · Total: {fmt(data.total_geral)}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Botões de exportação — só aparecem quando dados carregados */}
            {data && (
              <>
                <button
                  onClick={() => exportarExcel(data, nomeMes, ano)}
                  title="Exportar Excel"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.45rem 0.9rem', borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                    color: '#22c55e', fontSize: '0.8rem', fontWeight: 600,
                  }}
                >
                  <FileSpreadsheet size={15} /> Excel
                </button>
                <button
                  onClick={() => exportarPDF(data, nomeMes, ano)}
                  title="Exportar PDF"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.45rem 0.9rem', borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    color: '#ef4444', fontSize: '0.8rem', fontWeight: 600,
                  }}
                >
                  <FileDown size={15} /> PDF
                </button>
              </>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 8 }}>
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Corpo */}
        <div style={{ padding: '1.5rem 2rem' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Carregando dados...
            </div>
          )}

          {erro && (
            <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', borderRadius: 10, color: '#f87171' }}>
              {erro}
            </div>
          )}

          {data && !loading && (
            <>
              {/* Cards de resumo rápido */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {data.clt.quantidade > 0 && (
                  <>
                    <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '1rem' }}>
                      <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Briefcase size={12} /> CLT — Profissionais
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.clt.quantidade}</div>
                    </div>
                    <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '1rem' }}>
                      <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.3rem' }}>CLT — Total a Pagar</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#22c55e' }}>{fmt(data.clt.total_valor_bruto)}</div>
                    </div>
                  </>
                )}
                {data.pj.quantidade > 0 && (
                  <>
                    <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '1rem' }}>
                      <div style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Users size={12} /> PJ — Profissionais
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.pj.quantidade}</div>
                    </div>
                    <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '1rem' }}>
                      <div style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.3rem' }}>PJ — Total a Pagar</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#3b82f6' }}>{fmt(data.pj.total_valor_bruto)}</div>
                    </div>
                  </>
                )}
                <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '1rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.3rem' }}>Total Geral</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#818cf8' }}>{fmt(data.total_geral)}</div>
                </div>
              </div>

              {/* Seletor de aba */}
              {data.clt.quantidade > 0 && data.pj.quantidade > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  {[
                    { key: 'ambos', label: 'Ver Todos' },
                    { key: 'clt', label: `CLT (${data.clt.quantidade})` },
                    { key: 'pj', label: `PJ (${data.pj.quantidade})` },
                  ].map(({ key, label }) => (
                    <button key={key} onClick={() => setAba(key)} style={{
                      padding: '0.45rem 1rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                      border: '1px solid var(--border-color, #2d2d3f)',
                      background: aba === key ? 'var(--gradient-primary, linear-gradient(135deg,#0066FF,#00D4FF))' : 'transparent',
                      color: aba === key ? 'white' : 'var(--text-muted)',
                    }}>{label}</button>
                  ))}
                </div>
              )}

              {/* Tabelas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {(aba === 'clt' || aba === 'ambos') && data.clt.quantidade > 0 && (
                  <div>
                    <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#16a34a' }}>
                      <Briefcase size={15} /> CLT — Contratos Trabalhistas
                    </h3>
                    <TabelaResumo registros={data.clt.registros} tipo="clt" onEditar={setRegistroEditando} />
                  </div>
                )}
                {(aba === 'pj' || aba === 'ambos') && data.pj.quantidade > 0 && (
                  <div>
                    <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6' }}>
                      <Users size={15} /> PJ — Prestadores de Serviço
                    </h3>
                    <TabelaResumo registros={data.pj.registros} tipo="pj" onEditar={setRegistroEditando} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de edição individual */}
      {registroEditando && (
        <ModalEdicaoRegistro
          registro={registroEditando}
          onClose={() => setRegistroEditando(null)}
          onSalvo={() => { setRegistroEditando(null); carregar(); }}
        />
      )}
    </div>
  );
};

export default ResumoMensalModal;
