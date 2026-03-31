import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, ArrowRight, Check, UserPlus, X, Loader } from 'lucide-react';
import api from '../services/api';

const UNIDADES = ['MATRIZ', 'ANEXO', 'SÃO JOSÉ'];
const TURNOS = ['MANHÃ', 'TARDE', 'AMBOS', 'INDEFINIDO'];
const ESPECIALIDADES_FALLBACK = ['Fisio', 'Fisio Pelv', 'Neuro', 'Acupuntura', 'RPG', 'Pilates'];

// ---------- Formulário de cadastro rápido inline ----------
const CadastroRapido = ({ item, tipoContrato, onCadastrado, onCancelar }) => {
  const [form, setForm] = useState({
    nome: item.nome_planilha,
    especialidade: 'Fisio',
    unidade: item.unidade || 'MATRIZ',
    turno: item.turno === 'MANHÃ/TARDE' ? 'AMBOS' : (item.turno || 'INDEFINIDO'),
    tipo_contrato: tipoContrato === 'clt' ? 'clt' : 'prestador',
    meta_mensal: '',
    valor_fixo_base: '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [especialidades, setEspecialidades] = useState(ESPECIALIDADES_FALLBACK);
  const defaultsRef = useRef(null);

  // Carregar defaults e lista de especialidades da configuração
  useEffect(() => {
    api.get('/atendimentos/defaults-especialidade').then(res => {
      defaultsRef.current = res.data;
      if (res.data.especialidades?.length) {
        setEspecialidades(res.data.especialidades);
      }
      const unidade = item.unidade || 'MATRIZ';
      const tipo = tipoContrato === 'clt' ? 'clt' : 'prestador';
      aplicarDefaults('Fisio', unidade, tipo, res.data);
    }).catch(() => {});
  }, []);

  const aplicarDefaults = (especialidade, unidade, tipo_contrato, tabela = defaultsRef.current) => {
    if (!tabela) return;
    const grupo = tabela[tipo_contrato] || {};
    const d = grupo[especialidade] || {};
    let meta = d.meta_mensal != null ? String(d.meta_mensal) : '';
    let fixo = d.valor_fixo_base != null ? String(d.valor_fixo_base) : '';
    // PJ: usar valores por unidade quando disponível
    if (tipo_contrato === 'prestador' && d.por_unidade?.[unidade]) {
      const pu = d.por_unidade[unidade];
      meta = pu.meta_mensal != null ? String(pu.meta_mensal) : '';
      fixo = pu.valor_fixo_base != null ? String(pu.valor_fixo_base) : '';
    }
    setForm(prev => ({ ...prev, meta_mensal: meta, valor_fixo_base: fixo }));
  };

  const inp = {
    padding: '0.35rem 0.6rem', borderRadius: 6,
    border: '1px solid var(--border-color, #444)',
    background: 'var(--bg-input, #1a1a2e)', color: 'inherit',
    fontSize: '0.8rem', width: '100%',
  };
  const sel = { ...inp };

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => {
      const novo = { ...prev, [name]: value };
      const esp = name === 'especialidade' ? value : prev.especialidade;
      const unidade = name === 'unidade' ? value : prev.unidade;
      const tipo = name === 'tipo_contrato' ? value : prev.tipo_contrato;
      // Ao trocar especialidade, unidade ou tipo, preencher meta/fixo automaticamente
      if (['especialidade', 'unidade', 'tipo_contrato'].includes(name)) {
        aplicarDefaults(esp, unidade, tipo);
      }
      return novo;
    });
  };

  const handleSalvar = async () => {
    if (!form.nome.trim()) { setErro('Nome obrigatório'); return; }
    setSalvando(true); setErro('');
    try {
      const res = await api.post('/atendimentos/prestadores/cadastro-rapido', {
        nome: form.nome.trim(),
        especialidade: form.especialidade,
        unidade: form.unidade,
        turno: form.turno,
        tipo_contrato: form.tipo_contrato,
        meta_mensal: form.meta_mensal ? parseFloat(form.meta_mensal) : null,
        valor_fixo_base: form.valor_fixo_base ? parseFloat(form.valor_fixo_base) : null,
      });
      onCadastrado(res.data);
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao cadastrar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{
      marginTop: '0.75rem', padding: '1rem', borderRadius: 10,
      background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.25)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#818cf8' }}>
          <UserPlus size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
          Cadastro Rápido
        </span>
        <button onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
          Nome
          <input name="nome" value={form.nome} onChange={handleChange} style={inp} />
        </label>
        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
          Especialidade
          <select name="especialidade" value={form.especialidade} onChange={handleChange} style={sel}>
            {especialidades.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
          Unidade
          <select name="unidade" value={form.unidade} onChange={handleChange} style={sel}>
            {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
          Turno
          <select name="turno" value={form.turno} onChange={handleChange} style={sel}>
            {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
          Tipo Contrato
          <select name="tipo_contrato" value={form.tipo_contrato} onChange={handleChange} style={sel}>
            <option value="prestador">PJ</option>
            <option value="clt">CLT</option>
          </select>
        </label>
        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
          Meta Mensal (R$)
          <input name="meta_mensal" type="number" value={form.meta_mensal} onChange={handleChange} placeholder="opcional" style={inp} />
        </label>
        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3, gridColumn: '1/-1' }}>
          Fixo (R$)
          <input name="valor_fixo_base" type="number" value={form.valor_fixo_base} onChange={handleChange} placeholder="opcional" style={{ ...inp, width: 'auto' }} />
        </label>
      </div>

      {erro && (
        <div style={{ marginTop: '0.5rem', color: '#f87171', fontSize: '0.75rem' }}>{erro}</div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
        <button onClick={onCancelar} style={{
          padding: '0.35rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-color,#444)',
          background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '0.78rem',
        }}>Cancelar</button>
        <button onClick={handleSalvar} disabled={salvando} style={{
          padding: '0.35rem 0.9rem', borderRadius: 6, border: 'none',
          background: '#6366f1', color: '#fff', fontWeight: 600,
          cursor: salvando ? 'not-allowed' : 'pointer', fontSize: '0.78rem',
          display: 'flex', alignItems: 'center', gap: 5, opacity: salvando ? 0.7 : 1,
        }}>
          {salvando ? <Loader size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Check size={12} />}
          {salvando ? 'Cadastrando...' : 'Cadastrar e Vincular'}
        </button>
      </div>
    </div>
  );
};

// ---------- Componente principal ----------
const MapeamentoNomes = ({ naoReconhecidos, prestadores, tipoContrato, onMapeamentoChange, onPrestadoresAtualizado }) => {
  const [mapeamentos, setMapeamentos] = useState(() => {
    const init = {};
    naoReconhecidos.forEach((item) => {
      init[item.nome_planilha] = { vinculo_id: '', ignorar: false, cadastroAberto: false };
    });
    return init;
  });

  const handleVinculoChange = (nomePlanilha, vinculoId) => {
    const novo = {
      ...mapeamentos,
      [nomePlanilha]: { ...mapeamentos[nomePlanilha], vinculo_id: vinculoId, ignorar: false, cadastroAberto: false },
    };
    setMapeamentos(novo);
    notificar(novo);
  };

  const handleIgnorar = (nomePlanilha) => {
    const novo = {
      ...mapeamentos,
      [nomePlanilha]: { vinculo_id: '', ignorar: true, cadastroAberto: false },
    };
    setMapeamentos(novo);
    notificar(novo);
  };

  const toggleCadastro = (nomePlanilha) => {
    setMapeamentos(prev => ({
      ...prev,
      [nomePlanilha]: { ...prev[nomePlanilha], cadastroAberto: !prev[nomePlanilha]?.cadastroAberto },
    }));
  };

  const handleCadastrado = (nomePlanilha, resultado) => {
    // Atualizar lista de prestadores localmente
    if (onPrestadoresAtualizado) onPrestadoresAtualizado(resultado);

    const novo = {
      ...mapeamentos,
      [nomePlanilha]: {
        vinculo_id: String(resultado.vinculo_id),
        ignorar: false,
        cadastroAberto: false,
      },
    };
    setMapeamentos(novo);
    notificar(novo, [...prestadores, resultado]);
  };

  const notificar = (estado, listaPrestadores = prestadores) => {
    const resultado = Object.entries(estado)
      .filter(([, v]) => !v.ignorar && v.vinculo_id)
      .map(([nomePlanilha, v]) => {
        const vinculo = listaPrestadores.find(p => String(p.vinculo_id) === String(v.vinculo_id));
        return {
          nome_planilha: nomePlanilha,
          prestador_id: vinculo?.prestador_id,
          vinculo_id: vinculo?.vinculo_id,
        };
      });
    onMapeamentoChange(resultado);
  };

  const mapeadosCount = Object.values(mapeamentos).filter(m => m.vinculo_id || m.ignorar).length;
  const totalCount = naoReconhecidos.length;

  // Deduplica o select: agrupa por nome, mostra só um vínculo por profissional
  // (o INDEFINIDO ou o primeiro disponível), para não poluir a lista
  const prestadoresDeduplicados = (() => {
    const vistos = new Map();
    for (const p of prestadores) {
      const key = p.prestador_id;
      if (!vistos.has(key)) {
        vistos.set(key, p);
      } else {
        // Prefer INDEFINIDO turno for generic linking, otherwise keep first
        const atual = vistos.get(key);
        if (!atual.turno || atual.turno === 'INDEFINIDO') continue;
        if (!p.turno || p.turno === 'INDEFINIDO') vistos.set(key, p);
      }
    }
    return [...vistos.values()];
  })();

  return (
    <div>
      <div className="cp-alert cp-alert-warn" style={{ marginBottom: '1.5rem' }}>
        <AlertTriangle size={18} />
        <div>
          <strong>{totalCount} profissional(is) não reconhecido(s)</strong> na planilha.
          Vincule a um prestador cadastrado, cadastre rapidamente, ou clique em "Ignorar".
          Mapeamentos são lembrados em uploads futuros.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 className="cp-section-title" style={{ margin: 0 }}>
          <AlertTriangle size={18} color="#d97706" />
          Vincular Profissionais
        </h3>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {mapeadosCount}/{totalCount} resolvidos
        </span>
      </div>

      <div className="mapeamento-list">
        {naoReconhecidos.map((item) => {
          const estado = mapeamentos[item.nome_planilha] || {};
          const isIgnorado = estado.ignorar;
          const isMapeado = !!estado.vinculo_id;
          const cadastroAberto = estado.cadastroAberto;

          return (
            <div
              key={`${item.nome_planilha}|${item.turno || 'X'}`}
              className={`mapeamento-item ${isIgnorado ? 'mapeamento-ignorado' : ''}`}
              style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}
            >
              {/* Linha principal */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {/* Nome na planilha */}
                <div className="mapeamento-nome-planilha" style={{ flex: '1 1 180px' }}>
                  {item.nome_planilha}
                  <small>
                    {item.turno} · {item.unidade || '?'} · {item.atendimentos} atendimento(s) ·{' '}
                    R$ {((item.valor_clinica_total ?? item.valor_clinica) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} faturado
                  </small>
                </div>

                <div className="mapeamento-arrow"><ArrowRight size={18} /></div>

                {/* Select do prestador */}
                <div className="mapeamento-select-wrap" style={{ flex: '2 1 220px' }}>
                  <select
                    className={`mapeamento-select ${isMapeado ? 'mapped' : ''}`}
                    value={estado.vinculo_id || ''}
                    onChange={e => handleVinculoChange(item.nome_planilha, e.target.value)}
                    disabled={isIgnorado}
                  >
                    <option value="">— Selecionar prestador —</option>
                    {item.sugestoes && item.sugestoes.length > 0 && (
                      <optgroup label="Sugestões">
                        {item.sugestoes.map(s => (
                          <option key={`sug-${s.vinculo_id}`} value={s.vinculo_id}>
                            {s.nome} — {s.especialidade || '?'} / {s.turno || '?'} ({Math.round(s.sim * 100)}% similar)
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Todos os prestadores">
                      {prestadoresDeduplicados.map(p => (
                        <option key={p.vinculo_id} value={p.vinculo_id}>
                          {p.nome} — {p.especialidade || '?'} / {p.turno || 'INDEF'} / {p.unidade || '?'}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  {isMapeado && (
                    <span style={{ fontSize: '0.75rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Check size={12} /> Vinculado
                    </span>
                  )}
                </div>

                {/* Botões de ação */}
                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  {!isIgnorado && (
                    <button
                      onClick={() => toggleCadastro(item.nome_planilha)}
                      title="Cadastrar novo profissional"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '0.35rem 0.6rem', borderRadius: 6, cursor: 'pointer',
                        background: cadastroAberto ? 'rgba(99,102,241,0.2)' : 'transparent',
                        border: '1px solid rgba(99,102,241,0.4)',
                        color: '#818cf8', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap',
                      }}
                    >
                      <UserPlus size={12} /> Cadastrar
                    </button>
                  )}
                  <button
                    className="mapeamento-ignore-btn"
                    onClick={() => handleIgnorar(item.nome_planilha)}
                    title="Ignorar este profissional"
                  >
                    {isIgnorado ? 'Ignorado' : 'Ignorar'}
                  </button>
                </div>
              </div>

              {/* Formulário de cadastro rápido (expansível) */}
              {cadastroAberto && (
                <CadastroRapido
                  item={item}
                  tipoContrato={tipoContrato}
                  onCadastrado={(resultado) => handleCadastrado(item.nome_planilha, resultado)}
                  onCancelar={() => toggleCadastro(item.nome_planilha)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MapeamentoNomes;
