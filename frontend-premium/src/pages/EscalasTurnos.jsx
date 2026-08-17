import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, Clock, PartyPopper, Plane, Save, Plus, Trash2, RefreshCw, Info,
} from 'lucide-react';
import api from '../services/api';
import '../styles/EscalasTurnos.css';

/** ISO: 1 = segunda … 7 = domingo. */
const DIAS = [
  { n: 1, curto: 'S', label: 'Segunda' },
  { n: 2, curto: 'T', label: 'Terça' },
  { n: 3, curto: 'Q', label: 'Quarta' },
  { n: 4, curto: 'Q', label: 'Quinta' },
  { n: 5, curto: 'S', label: 'Sexta' },
  { n: 6, curto: 'S', label: 'Sábado' },
  { n: 7, curto: 'D', label: 'Domingo' },
];

const TIPOS_AUSENCIA = [
  { v: 'ferias', label: 'Férias' },
  { v: 'atestado', label: 'Atestado' },
  { v: 'licenca', label: 'Licença' },
  { v: 'folga', label: 'Folga combinada' },
];

const parseDias = (csv) =>
  csv ? new Set(String(csv).split(',').map(Number).filter(Boolean)) : null;

const formatarData = (iso) => {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

/**
 * Seletor de dias da semana. `dias = null` significa "todos os dias em que a
 * unidade abre" — é o padrão e não precisa ser gravado.
 */
const SeletorDias = ({ dias, onChange, disabled }) => {
  const set = dias ?? new Set(DIAS.map(d => d.n));
  const herdado = dias === null;

  const alternar = (n) => {
    const novo = new Set(set);
    if (novo.has(n)) novo.delete(n); else novo.add(n);
    onChange(novo);
  };

  return (
    <div className={`seletor-dias ${herdado ? 'herdado' : ''}`}>
      {DIAS.map(d => (
        <button
          key={d.n}
          type="button"
          className={`dia-btn ${set.has(d.n) ? 'on' : ''}`}
          onClick={() => alternar(d.n)}
          disabled={disabled}
          title={d.label}
          aria-pressed={set.has(d.n)}
          aria-label={d.label}
        >
          {d.curto}
        </button>
      ))}
    </div>
  );
};

const EscalasTurnos = () => {
  const [aba, setAba] = useState('escalas');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [msg, setMsg] = useState(null);

  const [vinculos, setVinculos] = useState([]);
  const [ausencias, setAusencias] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [anoFeriados, setAnoFeriados] = useState(String(new Date().getFullYear()));

  // Edições pendentes de escala: vinculo_id -> Set(dias) | null
  const [rascunho, setRascunho] = useState({});
  const [salvando, setSalvando] = useState(null);

  const [novaAusencia, setNovaAusencia] = useState({
    prestador_id: '', tipo: 'ferias', data_inicio: '', data_fim: '', observacao: '',
  });

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [esc, trn, fer] = await Promise.all([
        api.get('/turnos/escalas/lista'),
        api.get('/turnos'),
        api.get(`/turnos/feriados/lista?ano=${anoFeriados}`),
      ]);
      setVinculos(esc.data.vinculos || []);
      setAusencias(esc.data.ausencias || []);
      setTurnos(trn.data.turnos || []);
      setFeriados(fer.data.feriados || []);
      setRascunho({});
    } catch (e) {
      setErro(e.response?.data?.error || 'Não foi possível carregar as configurações.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [anoFeriados]);

  const avisar = (t) => { setMsg(t); setTimeout(() => setMsg(null), 3000); };

  const salvarEscala = async (v) => {
    const dias = rascunho[v.id];
    if (dias === undefined) return;
    setSalvando(v.id);
    try {
      const { data } = await api.put(`/turnos/escalas/${v.id}`, {
        dias_semana: dias ? [...dias].sort((a, b) => a - b) : [],
      });
      setVinculos(prev => prev.map(x => x.id === v.id ? { ...x, dias_semana: data.dias_semana } : x));
      setRascunho(prev => { const n = { ...prev }; delete n[v.id]; return n; });
      avisar(`Escala de ${v.nome} salva.`);
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao salvar escala.');
    } finally {
      setSalvando(null);
    }
  };

  const criarAusencia = async () => {
    const { prestador_id, data_inicio, data_fim } = novaAusencia;
    if (!prestador_id || !data_inicio || !data_fim) {
      setErro('Escolha o profissional e o período da ausência.');
      return;
    }
    try {
      await api.post('/turnos/ausencias', { ...novaAusencia, prestador_id: Number(prestador_id) });
      setNovaAusencia({ prestador_id: '', tipo: 'ferias', data_inicio: '', data_fim: '', observacao: '' });
      await carregar();
      avisar('Ausência registrada.');
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao registrar ausência.');
    }
  };

  const removerAusencia = async (id) => {
    try {
      await api.delete(`/turnos/ausencias/${id}`);
      setAusencias(prev => prev.filter(a => a.id !== id));
      avisar('Ausência removida.');
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao remover ausência.');
    }
  };

  const gerarFeriados = async () => {
    try {
      const { data } = await api.post(`/turnos/feriados/gerar/${anoFeriados}`);
      await carregar();
      avisar(`${data.inseridos} feriado(s) gerado(s) para ${anoFeriados}.`);
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao gerar feriados.');
    }
  };

  // Só vínculos com turno definido têm escala: INDEFINIDO/AMBOS atendem em qualquer dia.
  const comTurno = useMemo(
    () => vinculos.filter(v => !['INDEFINIDO', 'AMBOS'].includes(String(v.turno || '').toUpperCase())),
    [vinculos],
  );
  const pessoas = useMemo(() => {
    const m = new Map();
    vinculos.forEach(v => { if (!m.has(v.prestador_id)) m.set(v.prestador_id, v.nome); });
    return [...m.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  }, [vinculos]);

  const ABAS = [
    { id: 'escalas', label: 'Escala por profissional', Icone: CalendarDays, n: comTurno.length },
    { id: 'turnos', label: 'Horário das unidades', Icone: Clock, n: turnos.length },
    { id: 'ausencias', label: 'Férias e ausências', Icone: Plane, n: ausencias.length },
    { id: 'feriados', label: 'Feriados', Icone: PartyPopper, n: feriados.length },
  ];

  return (
    <div className="escalas-page">
      <header className="hub-header">
        <div>
          <h1>Escalas e Turnos</h1>
          <p>Quem trabalha em quais dias, o horário de cada unidade e o que não conta como falta.</p>
        </div>
        <button className="cp-btn-secondary" onClick={carregar} disabled={carregando}>
          <RefreshCw size={15} className={carregando ? 'cp-spin' : ''} /> Atualizar
        </button>
      </header>

      {erro && <div className="cp-alert cp-alert-error"><Info size={16} /> {erro}</div>}
      {msg && <div className="cp-alert cp-alert-success"><Info size={16} /> {msg}</div>}

      <div className="tabs-container glass-card">
        <div className="tabs" role="tablist">
          {ABAS.map(({ id, label, Icone, n }) => (
            <button
              key={id}
              role="tab"
              aria-selected={aba === id}
              className={`tab ${aba === id ? 'active' : ''}`}
              onClick={() => setAba(id)}
            >
              <Icone size={17} />
              <span>{label}</span>
              <span className="tab-count">{n}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Escala por profissional ─────────────────────────────────────── */}
      {aba === 'escalas' && (
        <div className="escala-card">
          <p className="escala-ajuda">
            Marque os dias em que o profissional atende <strong>naquele turno</strong>. A escala é do
            vínculo, não da pessoa — a Bruna Loretta atende todos os dias de manhã e só
            seg/qua/sex à tarde. Deixar a semana toda marcada equivale a
            &ldquo;todos os dias em que a unidade abre&rdquo;.
          </p>

          <div className="escala-lista">
            {comTurno.map(v => {
              const atual = v.id in rascunho ? rascunho[v.id] : parseDias(v.dias_semana);
              const alterado = v.id in rascunho;
              return (
                <div key={v.id} className={`escala-linha ${alterado ? 'alterada' : ''}`}>
                  <div className="escala-info">
                    <span className="escala-nome">{v.nome}</span>
                    <span className="escala-meta">
                      <span className={`ui-chip ${v.tipo_contrato === 'clt' ? 'ui-chip--clt' : 'ui-chip--pj'}`}>
                        {v.tipo_contrato === 'clt' ? 'CLT' : 'PJ'}
                      </span>
                      {v.especialidade} · {v.unidade} · {v.turno}
                    </span>
                  </div>

                  <SeletorDias
                    dias={atual}
                    onChange={(novo) => setRascunho(p => ({ ...p, [v.id]: novo }))}
                    disabled={salvando === v.id}
                  />

                  <button
                    className="ui-btn-mini ui-btn-mini--success"
                    onClick={() => salvarEscala(v)}
                    disabled={!alterado || salvando === v.id}
                  >
                    {salvando === v.id
                      ? <><RefreshCw size={11} className="cp-spin" /> Salvando</>
                      : <><Save size={11} /> Salvar</>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Horário das unidades ────────────────────────────────────────── */}
      {aba === 'turnos' && (
        <div className="escala-card">
          <p className="escala-ajuda">
            Base do detector de faltas: sem saber quando a unidade abre, não dá para dizer
            que a ausência num dia foi falta.
          </p>
          <table className="escala-tabela">
            <thead>
              <tr>
                <th>Unidade</th><th>Turno</th><th>Início</th><th>Fim</th><th>Dias</th><th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {turnos.map(t => (
                <tr key={t.id}>
                  <td>{t.unidade}</td>
                  <td>{t.turno}</td>
                  <td className="num">{t.hora_inicio}</td>
                  <td className="num">{t.hora_fim}</td>
                  <td>
                    {String(t.dias_semana).split(',')
                      .map(d => DIAS.find(x => x.n === Number(d))?.label.slice(0, 3).toLowerCase())
                      .join(' · ')}
                  </td>
                  <td>
                    <span className={`ui-chip ${t.ativo ? 'ui-chip--success' : ''}`}>
                      {t.ativo ? 'ativo' : 'inativo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Férias e ausências ──────────────────────────────────────────── */}
      {aba === 'ausencias' && (
        <div className="escala-card">
          <p className="escala-ajuda">
            Dia coberto por férias, atestado, licença ou folga combinada não vira falta —
            já entra na conferência classificado e descartado.
          </p>

          <div className="ausencia-form">
            <select
              value={novaAusencia.prestador_id}
              onChange={e => setNovaAusencia(p => ({ ...p, prestador_id: e.target.value }))}
              className="cp-select"
            >
              <option value="">— Profissional —</option>
              {pessoas.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
            <select
              value={novaAusencia.tipo}
              onChange={e => setNovaAusencia(p => ({ ...p, tipo: e.target.value }))}
              className="cp-select"
            >
              {TIPOS_AUSENCIA.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
            <input
              type="date" className="cp-select" aria-label="Início"
              value={novaAusencia.data_inicio}
              onChange={e => setNovaAusencia(p => ({ ...p, data_inicio: e.target.value }))}
            />
            <input
              type="date" className="cp-select" aria-label="Fim"
              value={novaAusencia.data_fim}
              onChange={e => setNovaAusencia(p => ({ ...p, data_fim: e.target.value }))}
            />
            <input
              type="text" className="cp-select" placeholder="Observação (opcional)"
              value={novaAusencia.observacao}
              onChange={e => setNovaAusencia(p => ({ ...p, observacao: e.target.value }))}
            />
            <button className="cp-btn-primary" onClick={criarAusencia}>
              <Plus size={15} /> Registrar
            </button>
          </div>

          <table className="escala-tabela">
            <thead>
              <tr><th>Profissional</th><th>Tipo</th><th>De</th><th>Até</th><th>Observação</th><th /></tr>
            </thead>
            <tbody>
              {ausencias.map(a => (
                <tr key={a.id}>
                  <td>{a.nome}</td>
                  <td>
                    <span className="ui-chip ui-chip--warn">
                      {TIPOS_AUSENCIA.find(t => t.v === a.tipo)?.label || a.tipo}
                    </span>
                  </td>
                  <td className="num">{formatarData(a.data_inicio)}</td>
                  <td className="num">{formatarData(a.data_fim)}</td>
                  <td className="obs">{a.observacao || '—'}</td>
                  <td>
                    <button className="ui-btn-mini ui-btn-mini--danger" onClick={() => removerAusencia(a.id)}>
                      <Trash2 size={11} /> Remover
                    </button>
                  </td>
                </tr>
              ))}
              {!ausencias.length && (
                <tr><td colSpan={6} className="vazio">Nenhuma ausência registrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Feriados ────────────────────────────────────────────────────── */}
      {aba === 'feriados' && (
        <div className="escala-card">
          <div className="feriados-head">
            <p className="escala-ajuda">
              Nacionais, do Amazonas e de Manaus. Calculados pelo sistema — inclusive os
              móveis, que dependem da Páscoa.
            </p>
            <div className="feriados-acoes">
              <select className="cp-select" value={anoFeriados} onChange={e => setAnoFeriados(e.target.value)}>
                {Array.from({ length: 8 }, (_, i) => 2024 + i).map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <button className="cp-btn-secondary" onClick={gerarFeriados}>
                <Plus size={15} /> Gerar {anoFeriados}
              </button>
            </div>
          </div>

          <table className="escala-tabela">
            <thead><tr><th>Data</th><th>Feriado</th><th>Escopo</th><th>Tipo</th></tr></thead>
            <tbody>
              {feriados.map(f => (
                <tr key={f.id}>
                  <td className="num">{formatarData(f.data)}</td>
                  <td>{f.nome}</td>
                  <td>{f.escopo}</td>
                  <td>
                    <span className={`ui-chip ${f.facultativo ? '' : 'ui-chip--success'}`}>
                      {f.facultativo ? 'facultativo' : 'obrigatório'}
                    </span>
                  </td>
                </tr>
              ))}
              {!feriados.length && (
                <tr><td colSpan={4} className="vazio">Nenhum feriado em {anoFeriados}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EscalasTurnos;
