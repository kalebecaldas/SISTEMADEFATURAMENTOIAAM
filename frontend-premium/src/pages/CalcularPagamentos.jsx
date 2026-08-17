import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Calculator,
  ArrowRight, ArrowLeft, Info, RefreshCw, Users, DollarSign,
  BarChart2, CreditCard, ChevronRight, ShieldAlert, Trash2, CheckSquare
} from 'lucide-react';
import api from '../services/api';
import { parseAnalisarAtendimentosResponse, parsePrestadoresList } from '../api/atendimentos';
import MapeamentoNomes from '../components/MapeamentoNomes';
import TabelaPreviewCalculo from '../components/TabelaPreviewCalculo';
import FaltasConferencia from '../components/FaltasConferencia';
import '../styles/CalcularPagamentos.css';

const MESES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const anoAtual = new Date().getFullYear();
const ANOS = [anoAtual - 1, anoAtual, anoAtual + 1];

const ETAPAS = [
  { num: 1, label: 'Upload' },
  { num: 2, label: 'Mapeamento' },
  { num: 3, label: 'Revisão' },
  { num: 4, label: 'Confirmação' },
];

const CalcularPagamentos = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Estado da etapa atual
  const [etapa, setEtapa] = useState(1);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  // Etapa 1: upload
  const [arquivo, setArquivo] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [tipoContrato, setTipoContrato] = useState(''); // '' = auto-detectar
  const [mes, setMes] = useState('');
  const [ano, setAno] = useState(String(anoAtual));

  // Etapa 2: resultado da análise
  const [analise, setAnalise] = useState(null);
  const [prestadores, setPrestadores] = useState([]);

  // Conflitos CLT detectados (profissionais PJ que também têm vínculo/dados CLT)
  const [conflitosClt, setConflitosClt] = useState([]); // lista original
  const [conflitosDescartados, setConflitosDescartados] = useState(new Set()); // prestador_ids ignorados ("já contemplado")

  // Turnos divergentes detectados (vínculo de turno fixo recebeu atendimento do turno oposto)
  const [turnosDivergentes, setTurnosDivergentes] = useState([]);
  // Faltas prováveis detectadas na planilha (Fase 3). `decisoesFaltas` guarda o
  // que o admin marcou na conferência: chave "vinculoId|data" -> confirmada|descartada.
  const [faltasDetectadas, setFaltasDetectadas] = useState([]);
  const [faltasPorProfissional, setFaltasPorProfissional] = useState([]);
  const [decisoesFaltas, setDecisoesFaltas] = useState({});
  const [turnosDivergentesResolvidos, setTurnosDivergentesResolvidos] = useState(new Set()); // chave vinculo_id|turno_vinculo
  const [criandoVinculoTurno, setCriandoVinculoTurno] = useState(null); // chave em criação (loading)

  // Etapa 2: mapeamentos resolvidos pelo admin
  const [mapeamentosNovos, setMapeamentosNovos] = useState([]);

  // Etapa 3: itens calculados (editáveis)
  const [itensCalculados, setItensCalculados] = useState([]);

  // Etapa 4: substituir dados existentes
  const [substituir, setSubstituir] = useState(false);
  const [resultadoConfirmacao, setResultadoConfirmacao] = useState(null);

  /* ---- Handlers de Upload ---- */
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validarESetarArquivo(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) validarESetarArquivo(file);
  };

  const validarESetarArquivo = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'xlsm'].includes(ext)) {
      setErro('Apenas arquivos Excel (.xlsx, .xls, .xlsm) são aceitos.');
      return;
    }
    setArquivo(file);
    setErro(null);
  };

  /* ---- Etapa 1 → 2: Analisar planilha ---- */
  const analisarPlanilha = async () => {
    if (!arquivo) {
      setErro('Selecione um arquivo antes de continuar.');
      return;
    }
    setLoading(true);
    setErro(null);

    const formData = new FormData();
    formData.append('planilha', arquivo);
    if (tipoContrato) formData.append('tipo_contrato_forcado', tipoContrato);

    try {
      const res = await api.post('/atendimentos/analisar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const data = parseAnalisarAtendimentosResponse(res.data);
      setAnalise(data);

      // Sincronizar mes/ano detectado se não foi forçado
      if (!mes && data.mes) setMes(String(data.mes));
      if (data.ano) setAno(String(data.ano));
      setTipoContrato(data.tipo_contrato);

      // Carregar lista de prestadores para mapeamento
      const prestRes = await api.get(
        `/atendimentos/prestadores?tipo_contrato=${data.tipo_contrato}`
      );
      setPrestadores(parsePrestadoresList(prestRes.data));

      // Conflitos CLT detectados
      if (data.conflitos_clt?.length > 0) {
        setConflitosClt(data.conflitos_clt);
        setConflitosDescartados(new Set());
      } else {
        setConflitosClt([]);
      }

      // Turnos divergentes detectados
      setTurnosDivergentes(data.turnos_divergentes || []);
      setFaltasDetectadas(data.faltas_detectadas || []);
      setFaltasPorProfissional(data.faltas_por_profissional || []);
      setDecisoesFaltas({});
      setTurnosDivergentesResolvidos(new Set());

      // Preparar itens calculados para a etapa 3
      setItensCalculados(data.calculados);

      // Se não há nomes a mapear, pular etapa 2
      if (!data.nao_reconhecidos || data.nao_reconhecidos.length === 0) {
        setEtapa(3);
      } else {
        setEtapa(2);
      }
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao processar a planilha.');
    } finally {
      setLoading(false);
    }
  };

  /* ---- Etapa 2 → 3: Confirmar mapeamentos ---- */
  const confirmarMapeamentos = async () => {
    // Após mapear nomes novos, re-buscar o preview incluindo os recém-mapeados
    // por simplicidade, apenas avançar para a etapa 3 com os itens já calculados
    // Os itens dos nomes mapeados serão incluídos na confirmação via mapeamentos_novos
    setEtapa(3);
  };

  /* ---- Etapa 3 → 4: Confirmar e salvar ---- */
  const salvarDados = async () => {
    if (!mes || !ano) {
      setErro('Selecione mês e ano antes de salvar.');
      return;
    }

    const itensComRevisaoPendente = itensCalculados.filter(
      i => i.revisao_manual && (i.valor_bruto === null || i.valor_bruto === undefined)
    );
    if (itensComRevisaoPendente.length > 0) {
      setErro(
        `Preencha o valor manual de: ${itensComRevisaoPendente.map(i => i.nome).join(', ')}`
      );
      return;
    }

    setLoading(true);
    setErro(null);

    try {
      const res = await api.post(
        '/atendimentos/confirmar',
        {
          calculados: itensCalculados,
          faltas_detectadas: faltasDetectadas.map(f => ({
            ...f,
            status: decisoesFaltas[`${f.vinculo_id}|${f.data}`] || f.status,
          })),
          mapeamentos_novos: mapeamentosNovos,
          tipo_contrato: tipoContrato,
          mes: parseInt(mes),
          ano: parseInt(ano),
          substituir,
        },
      );

      setResultadoConfirmacao(res.data);
      setEtapa(4);
    } catch (err) {
      if (err.response?.status === 409) {
        setErro(
          `Já existem ${err.response.data.existentes} registros para este mês/ano. Marque "Substituir" para sobrescrever.`
        );
        setSubstituir(false);
      } else {
        setErro(err.response?.data?.error || 'Erro ao salvar dados.');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---- Reiniciar ---- */
  const reiniciar = () => {
    setEtapa(1);
    setArquivo(null);
    setAnalise(null);
    setItensCalculados([]);
    setMapeamentosNovos([]);
    setResultadoConfirmacao(null);
    setErro(null);
    setSubstituir(false);
    setTipoContrato('');
    setMes('');
    setAno(String(anoAtual));
    setConflitosClt([]);
    setConflitosDescartados(new Set());
    setTurnosDivergentes([]);
    setTurnosDivergentesResolvidos(new Set());
    setCriandoVinculoTurno(null);
  };

  // ── Ações sobre turnos divergentes ─────────────────────────────────────────
  const chaveTurnoDivergente = (t) => `${t.vinculo_id}|${t.turno_vinculo}`;

  // "É extra" — admin confirma que é cobertura ocasional, mantém como está (já mesclado)
  const marcarComoExtra = (t) => {
    setTurnosDivergentesResolvidos(prev => new Set(prev).add(chaveTurnoDivergente(t)));
  };

  // "Criar vínculo" — cria o vínculo do turno detectado pra esse profissional
  const criarVinculoTurno = async (t) => {
    const chave = chaveTurnoDivergente(t);
    const turnoNovo = (t.turnos_detectados || []).find(turno => turno !== t.turno_vinculo) || null;
    if (!turnoNovo) {
      setErro(`Não foi possível identificar o turno novo de ${t.nome}.`);
      return;
    }
    setCriandoVinculoTurno(chave);
    setErro(null);
    try {
      await api.post(`/atendimentos/prestadores/${t.prestador_id}/criar-vinculo-turno`, {
        especialidade: t.especialidade,
        unidade: t.unidade,
        turno: turnoNovo,
        meta_mensal: null,
        valor_fixo_base: null,
      });
      setTurnosDivergentesResolvidos(prev => new Set(prev).add(chave));
    } catch (err) {
      setErro(err.response?.data?.error || `Erro ao criar vínculo de ${turnoNovo} para ${t.nome}.`);
    } finally {
      setCriandoVinculoTurno(null);
    }
  };

  // ── Ações sobre conflitos CLT ──────────────────────────────────────────────

  // Remover da lista PJ (exclui do itensCalculados)
  const removerConflito = (prestadorId) => {
    setItensCalculados(prev => prev.filter(i => i.prestador_id !== prestadorId));
    setConflitosClt(prev => prev.filter(c => c.prestador_id !== prestadorId));
  };

  const removerTodosConflitos = () => {
    const ids = new Set(conflitosClt.map(c => c.prestador_id));
    setItensCalculados(prev => prev.filter(i => !ids.has(i.prestador_id)));
    setConflitosClt([]);
  };

  // Marcar como "já contemplado" (mantém na lista mas remove o aviso)
  const contemplarConflito = (prestadorId) => {
    setConflitosDescartados(prev => new Set([...prev, prestadorId]));
  };

  const contemplarTodosConflitos = () => {
    setConflitosDescartados(new Set(conflitosClt.map(c => c.prestador_id)));
  };

  // Conflitos visíveis (não marcados como contemplados)
  const conflitosVisiveis = conflitosClt.filter(c => !conflitosDescartados.has(c.prestador_id));
  const turnosDivergentesVisiveis = turnosDivergentes.filter(t => !turnosDivergentesResolvidos.has(chaveTurnoDivergente(t)));

  const mesAnoLabel = mes && ano
    ? `${MESES[parseInt(mes)]} ${ano}`
    : '—';

  return (
    <div className="calcular-pagamentos">
      {/* Header */}
      <div className="cp-header">
        <h1>Calcular Pagamentos</h1>
        <p>Faça upload da aba Atendimentos e o sistema calcula automaticamente os valores de cada profissional.</p>
      </div>

      {/* Stepper */}
      <div className="cp-stepper">
        {ETAPAS.map((e, idx) => (
          <React.Fragment key={e.num}>
            <div className={`cp-step ${etapa === e.num ? 'active' : etapa > e.num ? 'done' : ''}`}>
              <div className="cp-step-num">
                {etapa > e.num ? <CheckCircle size={16} /> : e.num}
              </div>
              <span className="cp-step-label">{e.label}</span>
            </div>
            {idx < ETAPAS.length - 1 && <div className="cp-step-divider" />}
          </React.Fragment>
        ))}
      </div>

      {/* Erro global */}
      {erro && (
        <div className="cp-alert cp-alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={18} />
          <span>{erro}</span>
        </div>
      )}

      {/* ========== ETAPA 1: UPLOAD ========== */}
      {etapa === 1 && (
        <div className="cp-card">
          <h2 className="cp-section-title">
            <FileSpreadsheet size={20} />
            Enviar Planilha de Atendimentos
          </h2>

          <div
            className={`cp-upload-zone ${dragging ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !arquivo && fileInputRef.current?.click()}
          >
            <Upload size={40} />
            <h3>{arquivo ? arquivo.name : 'Arraste a planilha ou clique para selecionar'}</h3>
            <p>Formatos aceitos: .xlsx, .xls, .xlsm — Máx. 30 MB</p>
            {!arquivo && (
              <button className="cp-btn-primary" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                Selecionar arquivo
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {arquivo && (
            <div className="cp-file-selected">
              <FileSpreadsheet size={22} />
              <span>{arquivo.name}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {(arquivo.size / 1024 / 1024).toFixed(2)} MB
              </span>
              <button
                className="cp-btn-danger"
                style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                onClick={() => { setArquivo(null); setErro(null); }}
              >
                Remover
              </button>
            </div>
          )}

          {/* Tipo de contrato */}
          <div style={{ marginTop: '1.5rem' }}>
            <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
              Tipo de contrato
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                (deixe em Auto para detecção automática pelas datas)
              </span>
            </p>
            <div className="cp-tipo-toggle">
              <button
                className={`cp-tipo-btn ${tipoContrato === '' ? 'active' : ''}`}
                onClick={() => setTipoContrato('')}
              >
                <RefreshCw size={16} /> Auto-detectar
              </button>
              <button
                className={`cp-tipo-btn ${tipoContrato === 'prestador' ? 'active' : ''}`}
                onClick={() => setTipoContrato('prestador')}
              >
                <Users size={16} /> PJ / Prestador
                <span style={{ fontSize: '0.7rem', background: '#3b82f6', color: 'white', padding: '0.1rem 0.4rem', borderRadius: 20 }}>dia 1–fim</span>
              </button>
              <button
                className={`cp-tipo-btn ${tipoContrato === 'clt' ? 'active' : ''}`}
                onClick={() => setTipoContrato('clt')}
              >
                <Users size={16} /> CLT
                <span style={{ fontSize: '0.7rem', background: '#d97706', color: 'white', padding: '0.1rem 0.4rem', borderRadius: 20 }}>dia 26–25</span>
              </button>
            </div>
          </div>

          <div className="cp-alert cp-alert-info" style={{ marginTop: '1.5rem' }}>
            <Info size={18} />
            <span>
              O sistema irá ler a aba <strong>Atendimentos</strong>, agregar por profissional + turno + unidade,
              detectar o tipo (CLT/PJ) pelas datas e calcular os valores automaticamente.
            </span>
          </div>

          <div className="cp-action-row">
            <button
              className="cp-btn-primary"
              onClick={analisarPlanilha}
              disabled={!arquivo || loading}
            >
              {loading ? <><RefreshCw size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Processando...</> : <><Calculator size={16} /> Analisar Planilha</>}
            </button>
          </div>
        </div>
      )}

      {/* ========== ETAPA 2: MAPEAMENTO DE NOMES ========== */}
      {etapa === 2 && analise && (
        <div className="cp-card">
          {/* Resumo da análise */}
          <div className="cp-summary-grid">
            <div className="cp-summary-card">
              <div className="label">Total Atendimentos</div>
              <div className="value blue">{analise.total_atendimentos?.toLocaleString('pt-BR')}</div>
            </div>
            <div className="cp-summary-card">
              <div className="label">Tipo Detectado</div>
              <div className="value blue">{tipoContrato === 'clt' ? 'CLT' : 'PJ'}</div>
            </div>
            <div className="cp-summary-card">
              <div className="label">Reconhecidos</div>
              <div className="value green">{analise.resumo.reconhecidos}</div>
            </div>
            <div className="cp-summary-card">
              <div className="label">Não Reconhecidos</div>
              <div className="value amber">{analise.resumo.nao_reconhecidos}</div>
            </div>
          </div>

          <MapeamentoNomes
            naoReconhecidos={analise.nao_reconhecidos}
            prestadores={prestadores}
            tipoContrato={analise.tipo_contrato}
            onMapeamentoChange={setMapeamentosNovos}
            onPrestadoresAtualizado={(novo) => {
              // Adiciona o novo prestador/vínculo à lista local para aparecer no select
              setPrestadores(prev => [...prev, {
                prestador_id: novo.prestador_id,
                vinculo_id: novo.vinculo_id,
                nome: novo.nome,
                especialidade: novo.especialidade,
                unidade: novo.unidade,
                turno: novo.turno,
                tipo_contrato: novo.tipo_contrato,
              }]);
            }}
          />

          <div className="cp-action-row">
            <button className="cp-btn-secondary" onClick={() => setEtapa(1)}>
              <ArrowLeft size={16} /> Voltar
            </button>
            <button className="cp-btn-primary" onClick={confirmarMapeamentos}>
              Continuar <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ========== ETAPA 3: PREVIEW E REVISÃO ========== */}
      {etapa === 3 && (
        <>
          {/* Seleção de mês/ano */}
          <div className="cp-card">
            <h2 className="cp-section-title">
              <Calculator size={20} />
              Período de Referência
            </h2>

            <div className="cp-periodo-row">
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                  Mês
                </label>
                <select className="cp-select" value={mes} onChange={e => setMes(e.target.value)}>
                  <option value="">— Mês —</option>
                  {MESES.slice(1).map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                  Ano
                </label>
                <select className="cp-select" value={ano} onChange={e => setAno(e.target.value)}>
                  {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                  Tipo
                </label>
                <div style={{
                  padding: '0.7rem 1rem', borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'var(--glass-bg)', fontWeight: 600,
                  color: tipoContrato === 'clt' ? '#d97706' : '#3b82f6',
                }}>
                  {tipoContrato === 'clt' ? 'CLT (dia 26–25)' : 'PJ (dia 1–fim)'}
                </div>
              </div>
            </div>

            {analise?.resumo.revisao_manual > 0 && (
              <div className="cp-alert cp-alert-warn" style={{ marginTop: '1rem' }}>
                <AlertTriangle size={18} />
                <span>
                  <strong>{analise.resumo.revisao_manual}</strong> profissional(is) necessitam de valor manual
                  (ex: RPG CLT). Informe o valor na coluna "Valor Final" destacada em laranja.
                </span>
              </div>
            )}
          </div>

          {/* ── Banner de conflitos CLT ── */}
          {conflitosVisiveis.length > 0 && (
            <div className="ui-banner ui-banner--attention">
              <div className="ui-banner-head">
                <div className="ui-banner-heading">
                  <ShieldAlert size={18} />
                  <div>
                    <span className="ui-banner-title">
                      {conflitosVisiveis.length} profissional(is) com atendimento CLT
                    </span>
                    <p className="ui-banner-desc">
                      Estes profissionais também possuem vínculo ou registro CLT neste período.
                      Verifique antes de confirmar para evitar duplicidade.
                    </p>
                  </div>
                </div>
                <div className="ui-banner-actions">
                  <button
                    className="ui-btn-mini ui-btn-mini--outline"
                    onClick={contemplarTodosConflitos}
                    title="Manter todos na lista PJ (já contemplado no CLT)"
                  >
                    <CheckSquare size={13} /> Todos já contemplados
                  </button>
                  <button
                    className="ui-btn-mini ui-btn-mini--danger"
                    onClick={removerTodosConflitos}
                    title="Remover todos da lista PJ"
                  >
                    <Trash2 size={13} /> Remover todos da lista PJ
                  </button>
                </div>
              </div>

              <div className="ui-banner-rows">
                {conflitosVisiveis.map(c => (
                  <div key={c.prestador_id} className="ui-banner-row">
                    <div className="ui-banner-row-info">
                      <span className="ui-banner-row-name">{c.nome}</span>
                      <span className="ui-banner-row-meta">
                        {c.especialidade} · {c.unidade} · {c.turno}
                      </span>
                      <span className={`ui-chip ${c.motivo === 'dados_mensais_clt' ? 'ui-chip--success' : 'ui-chip--attention'}`}>
                        {c.motivo === 'dados_mensais_clt' ? 'CLT já salvo' : 'Vínculo CLT'}
                      </span>
                    </div>
                    <div className="ui-banner-actions">
                      <button
                        className="ui-btn-mini ui-btn-mini--outline"
                        onClick={() => contemplarConflito(c.prestador_id)}
                        title="Manter na lista PJ (já contemplado)"
                      >
                        <CheckSquare size={11} /> Já contemplado
                      </button>
                      <button
                        className="ui-btn-mini ui-btn-mini--danger"
                        onClick={() => removerConflito(c.prestador_id)}
                        title="Remover da lista PJ"
                      >
                        <Trash2 size={11} /> Remover da lista
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Banner de turnos divergentes ── */}
          {turnosDivergentesVisiveis.length > 0 && (
            <div className="ui-banner ui-banner--accent">
              <div className="ui-banner-head">
                <div className="ui-banner-heading">
                  <ShieldAlert size={18} />
                  <div>
                    <span className="ui-banner-title">
                      {turnosDivergentesVisiveis.length} possível(is) turno extra
                    </span>
                    <p className="ui-banner-desc">
                      Vínculo é de um turno só, mas detectamos atendimento também no outro turno.
                      Pode ser cobertura ocasional (extra) ou um turno novo que falta cadastrar.
                    </p>
                  </div>
                </div>
              </div>

              <div className="ui-banner-rows">
                {turnosDivergentesVisiveis.map(t => {
                  const chave = chaveTurnoDivergente(t);
                  const turnoNovo = (t.turnos_detectados || []).find(turno => turno !== t.turno_vinculo);
                  const criando = criandoVinculoTurno === chave;
                  return (
                    <div key={chave} className="ui-banner-row">
                      <div className="ui-banner-row-info">
                        <span className="ui-banner-row-name">{t.nome}</span>
                        <span className="ui-banner-row-meta">
                          {t.especialidade} · {t.unidade} · vínculo é {t.turno_vinculo}, atendeu também {turnoNovo}
                        </span>
                      </div>
                      <div className="ui-banner-actions">
                        <button
                          className="ui-btn-mini ui-btn-mini--outline"
                          onClick={() => marcarComoExtra(t)}
                          disabled={criando}
                          title="Cobertura ocasional — manter como está, mesclado no vínculo existente"
                        >
                          <CheckSquare size={11} /> É extra
                        </button>
                        <button
                          className="ui-btn-mini ui-btn-mini--success"
                          onClick={() => criarVinculoTurno(t)}
                          disabled={criando}
                          title={`Criar vínculo de ${turnoNovo} pra esse profissional`}
                        >
                          {criando
                            ? <><RefreshCw size={11} className="cp-spin" /> Criando...</>
                            : <>+ Criar vínculo {turnoNovo}</>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conferência de faltas prováveis (Fase 4) */}
          <FaltasConferencia
            grupos={faltasPorProfissional}
            onChange={setDecisoesFaltas}
          />

          {/* Tabela de cálculos */}
          <div className="cp-card" style={{ padding: '1.25rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem', padding: '0 0.25rem' }}>
              <h2 className="cp-section-title" style={{ margin: 0 }}>
                <DollarSign size={20} />
                Cálculos por Profissional ({itensCalculados.length})
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <Info size={14} />
                Edite faltas e extras — recalculado em tempo real
              </div>
            </div>

            {itensCalculados.length === 0 ? (
              <div className="cp-alert cp-alert-warn">
                <AlertTriangle size={18} />
                Nenhum profissional reconhecido. Volte e verifique o mapeamento de nomes.
              </div>
            ) : (
              <TabelaPreviewCalculo
                itens={itensCalculados}
                onChange={setItensCalculados}
              />
            )}

            {/* Erro local — repetido aqui (perto do botão) porque o aviso global do topo
                fica fora de vista quando a tabela é longa e o usuário rolou até o fim */}
            {erro && (
              <div className="cp-alert cp-alert-error" style={{ marginTop: '1.5rem' }}>
                <AlertTriangle size={18} />
                <span>{erro}</span>
              </div>
            )}

            {/* Dados existentes — opção substituir */}
            <label className="cp-substituir-check" style={{ marginTop: '1.5rem' }}>
              <input
                type="checkbox"
                checked={substituir}
                onChange={e => setSubstituir(e.target.checked)}
              />
              Substituir dados existentes para este mês/ano/tipo (se já processado anteriormente)
            </label>

            <div className="cp-action-row">
              <button
                className="cp-btn-secondary"
                onClick={() => setEtapa(analise?.nao_reconhecidos?.length > 0 ? 2 : 1)}
              >
                <ArrowLeft size={16} /> Voltar
              </button>
              <button
                className="cp-btn-primary"
                onClick={salvarDados}
                disabled={loading || !mes || !ano || itensCalculados.length === 0}
              >
                {loading
                  ? <><RefreshCw size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Salvando...</>
                  : <><CheckCircle size={16} /> Confirmar e Salvar</>}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ========== ETAPA 4: CONFIRMAÇÃO FINAL ========== */}
      {etapa === 4 && resultadoConfirmacao && (
        <div className="cp-card">
          <div style={{ textAlign: 'center', padding: '1rem 0 2rem' }}>
            <CheckCircle size={56} color="#22c55e" style={{ marginBottom: '1rem' }} />
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Pagamentos Salvos!
            </h2>
            <p style={{ color: 'var(--text-muted)' }}>{resultadoConfirmacao.mensagem}</p>
          </div>

          <div className="cp-summary-grid">
            <div className="cp-summary-card">
              <div className="label">Registros Salvos</div>
              <div className="value green">{resultadoConfirmacao.inseridos}</div>
            </div>
            <div className="cp-summary-card">
              <div className="label">Período</div>
              <div className="value blue" style={{ fontSize: '1.1rem' }}>{mesAnoLabel}</div>
            </div>
            <div className="cp-summary-card">
              <div className="label">Tipo</div>
              <div className="value blue" style={{ fontSize: '1.1rem' }}>
                {tipoContrato === 'clt' ? 'CLT' : 'PJ'}
              </div>
            </div>
            {resultadoConfirmacao.erros?.length > 0 && (
              <div className="cp-summary-card">
                <div className="label">Avisos</div>
                <div className="value amber">{resultadoConfirmacao.erros.length}</div>
              </div>
            )}
          </div>

          {resultadoConfirmacao.erros?.length > 0 && (
            <div className="cp-alert cp-alert-warn">
              <AlertTriangle size={18} />
              <div>
                <strong>Atenção:</strong>
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem' }}>
                  {resultadoConfirmacao.erros.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            </div>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              Os dados já estão disponíveis em todo o sistema:
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                className="cp-btn-primary"
                onClick={() => navigate('/financeiro')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <DollarSign size={16} /> Ver no Financeiro <ChevronRight size={14} />
              </button>
              <button
                className="cp-btn-secondary"
                onClick={() => navigate('/relatorios')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <BarChart2 size={16} /> Ver Relatórios <ChevronRight size={14} />
              </button>
              <button
                className="cp-btn-secondary"
                onClick={() => navigate('/financeiro')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <CreditCard size={16} /> Notificar Prestadores <ChevronRight size={14} />
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <button
                className="cp-btn-ghost"
                onClick={reiniciar}
                style={{ fontSize: '0.85rem', opacity: 0.7 }}
              >
                <Upload size={14} /> Processar Nova Planilha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalcularPagamentos;
