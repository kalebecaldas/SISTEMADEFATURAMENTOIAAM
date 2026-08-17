import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarX, CalendarCheck, PartyPopper, ArrowLeftRight, Plane,
  Check, X, ChevronDown, ChevronRight, Save, RefreshCw, Info,
} from 'lucide-react';
import api from '../services/api';
import '../styles/FaltasConferencia.css';

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const MOTIVOS = {
  feriado: { label: 'Feriado', Icone: PartyPopper, classe: 'motivo--feriado' },
  ferias: { label: 'Férias', Icone: Plane, classe: 'motivo--feriado' },
  atestado: { label: 'Atestado', Icone: Plane, classe: 'motivo--feriado' },
  licenca: { label: 'Licença', Icone: Plane, classe: 'motivo--feriado' },
  folga: { label: 'Folga combinada', Icone: Plane, classe: 'motivo--feriado' },
  atendeu_outro_turno: { label: 'Atendeu no outro turno', Icone: ArrowLeftRight, classe: 'motivo--troca' },
  fora_da_vigencia: { label: 'Fora da vigência', Icone: CalendarCheck, classe: 'motivo--vigencia' },
  sem_motivo: { label: 'Sem justificativa', Icone: CalendarX, classe: 'motivo--suspeita' },
};

// Motivos que o sistema já explicou sozinho — não exigem decisão do admin.
const AUTO_EXPLICADO = ['feriado', 'ferias', 'atestado', 'licenca', 'folga'];

const iso = (v) => String(v).slice(0, 10);

function formatarDia(v) {
  const [a, m, d] = iso(v).split('-').map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} (${DIAS_SEMANA[data.getUTCDay()]})`;
}

/**
 * Conferência das faltas de uma competência já fechada.
 *
 * Existe separada do fluxo de upload de propósito: revisar ausência de um mês
 * anterior não pode obrigar a reenviar a planilha só para chegar na tela.
 *
 * Nada é descontado até a confirmação — o backend recalcula
 * dados_mensais.faltas contando apenas o que ficou como 'confirmada'.
 */
const ConferenciaFaltas = () => {
  const hoje = new Date();
  const [mes, setMes] = useState(String(hoje.getMonth() + 1));
  const [ano, setAno] = useState(String(hoje.getFullYear()));

  const [faltas, setFaltas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [msg, setMsg] = useState(null);
  const [abertos, setAbertos] = useState({});
  // id da falta -> novo status ainda não salvo
  const [decisoes, setDecisoes] = useState({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const { data } = await api.get(`/turnos/faltas/${mes}/${ano}`);
      setFaltas(data.faltas || []);
      setDecisoes({});
    } catch (e) {
      setErro(e.response?.data?.error || 'Não foi possível carregar as faltas.');
    } finally {
      setCarregando(false);
    }
  }, [mes, ano]);

  useEffect(() => { carregar(); }, [carregar]);

  const decidir = (id, status) => {
    setDecisoes(prev => {
      const n = { ...prev };
      if (n[id] === status) delete n[id]; else n[id] = status;
      return n;
    });
  };

  const statusDe = (f) => decisoes[f.id] ?? f.status;

  const grupos = useMemo(() => {
    const m = new Map();
    for (const f of faltas) {
      const k = String(f.vinculo_id);
      if (!m.has(k)) {
        m.set(k, { chave: k, nome: f.nome, turno: f.turno, unidade: f.unidade, dias: [] });
      }
      m.get(k).dias.push(f);
    }
    return [...m.values()]
      .map(g => ({
        ...g,
        dias: g.dias.sort((a, b) => iso(a.data).localeCompare(iso(b.data))),
        pendentes: g.dias.filter(d => !AUTO_EXPLICADO.includes(d.motivo_deteccao)
          && statusDe(d) === 'suspeita').length,
        confirmadas: g.dias.filter(d => statusDe(d) === 'confirmada').length,
      }))
      // Ordem alfabética por nome. Ordenar por "quem tem mais pendência" parecia
      // útil, mas quem confere procura a pessoa na lista — e aí a ordem tem que ser
      // previsível. localeCompare pt-BR para acento não jogar nomes para o fim.
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
        || String(a.turno || '').localeCompare(String(b.turno || '')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faltas, decisoes]);

  const totais = useMemo(() => ({
    pendentes: grupos.reduce((s, g) => s + g.pendentes, 0),
    confirmadas: grupos.reduce((s, g) => s + g.confirmadas, 0),
    alteradas: Object.keys(decisoes).length,
  }), [grupos, decisoes]);

  const confirmarTodasPendentes = (grupo) => {
    setDecisoes(prev => {
      const n = { ...prev };
      grupo.dias
        .filter(d => !AUTO_EXPLICADO.includes(d.motivo_deteccao) && statusDe(d) === 'suspeita')
        .forEach(d => { n[d.id] = 'confirmada'; });
      return n;
    });
  };

  const salvar = async () => {
    const porStatus = {};
    for (const [id, status] of Object.entries(decisoes)) {
      (porStatus[status] ||= []).push(Number(id));
    }
    if (!Object.keys(porStatus).length) return;

    setSalvando(true);
    setErro(null);
    try {
      for (const [status, ids] of Object.entries(porStatus)) {
        await api.put('/turnos/faltas/status', { ids, status });
      }
      await carregar();
      setMsg('Conferência salva. O total de faltas do pagamento foi atualizado.');
      setTimeout(() => setMsg(null), 4000);
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao salvar a conferência.');
    } finally {
      setSalvando(false);
    }
  };

  const anos = Array.from({ length: 4 }, (_, i) => hoje.getFullYear() - 2 + i);

  return (
    <div className="conf-faltas">
      <div className="conf-faltas-topo">
        <div className="conf-faltas-periodo">
          <select className="cp-select" value={mes} onChange={e => setMes(e.target.value)}>
            {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select className="cp-select" value={ano} onChange={e => setAno(e.target.value)}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="cp-btn-secondary" onClick={carregar} disabled={carregando}>
            <RefreshCw size={15} className={carregando ? 'cp-spin' : ''} /> Atualizar
          </button>
        </div>

        <div className="faltas-conf-totais">
          <span className="ui-chip ui-chip--warn">{totais.pendentes} a revisar</span>
          <span className="ui-chip ui-chip--success">{totais.confirmadas} confirmadas</span>
          {totais.alteradas > 0 && (
            <button className="cp-btn-primary" onClick={salvar} disabled={salvando}>
              {salvando
                ? <><RefreshCw size={14} className="cp-spin" /> Salvando</>
                : <><Save size={14} /> Salvar {totais.alteradas} alteração(ões)</>}
            </button>
          )}
        </div>
      </div>

      {erro && <div className="cp-alert cp-alert-error"><Info size={16} /> {erro}</div>}
      {msg && <div className="cp-alert cp-alert-success"><Info size={16} /> {msg}</div>}

      <p className="escala-ajuda">
        Dias em que a unidade abriu, o profissional estava escalado e não houve nenhum
        atendimento. Só entra quem tem fixo no contrato — sem fixo não há de onde
        descontar. <strong>Nada é descontado até você confirmar.</strong>
      </p>

      {!carregando && !grupos.length && (
        <div className="faltas-vazio">
          <CalendarCheck size={20} />
          <span>Nenhuma ausência registrada em {MESES[Number(mes)]}/{ano}.</span>
        </div>
      )}

      <div className="faltas-lista">
        {grupos.map(grupo => {
          const aberto = abertos[grupo.chave];
          return (
            <div key={grupo.chave} className="falta-grupo">
              <button
                className="falta-grupo-head"
                onClick={() => setAbertos(p => ({ ...p, [grupo.chave]: !p[grupo.chave] }))}
                aria-expanded={!!aberto}
              >
                {aberto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className="falta-nome">{grupo.nome}</span>
                <span className="falta-meta">{grupo.unidade} · {grupo.turno}</span>
                <span className="falta-badges">
                  {grupo.pendentes > 0 && (
                    <span className="ui-chip ui-chip--attention">{grupo.pendentes} a revisar</span>
                  )}
                  {grupo.confirmadas > 0 && (
                    <span className="ui-chip ui-chip--success">{grupo.confirmadas} falta(s)</span>
                  )}
                </span>
              </button>

              {aberto && (
                <div className="falta-dias">
                  {grupo.pendentes > 1 && (
                    <button
                      className="ui-btn-mini ui-btn-mini--outline falta-bulk"
                      onClick={() => confirmarTodasPendentes(grupo)}
                    >
                      <Check size={12} /> Confirmar as {grupo.pendentes} pendentes
                    </button>
                  )}

                  {grupo.dias.map(d => {
                    const info = MOTIVOS[d.motivo_deteccao] || MOTIVOS.sem_motivo;
                    const { Icone } = info;
                    const st = statusDe(d);
                    const auto = AUTO_EXPLICADO.includes(d.motivo_deteccao);
                    const mudou = d.id in decisoes;

                    return (
                      <div
                        key={d.id}
                        className={`falta-dia ${st === 'confirmada' ? 'dia--confirmada' : ''} ${st === 'descartada' ? 'dia--descartada' : ''} ${mudou ? 'dia--alterado' : ''}`}
                      >
                        <span className="falta-dia-data">{formatarDia(d.data)}</span>
                        <span className={`falta-dia-motivo ${info.classe}`}>
                          <Icone size={13} />
                          {d.justificativa || info.label}
                        </span>

                        {auto ? (
                          <span className="falta-dia-nota">não conta</span>
                        ) : (
                          <span className="falta-dia-acoes">
                            <button
                              className={`ui-btn-mini ${st === 'confirmada' ? 'ui-btn-mini--danger' : 'ui-btn-mini--outline'}`}
                              onClick={() => decidir(d.id, 'confirmada')}
                              title="Foi falta mesmo — entra no cálculo do pagamento"
                            >
                              <Check size={11} /> Faltou
                            </button>
                            <button
                              className={`ui-btn-mini ${st === 'descartada' ? 'ui-btn-mini--success' : 'ui-btn-mini--outline'}`}
                              onClick={() => decidir(d.id, 'descartada')}
                              title="Não foi falta (sem agenda, folga, remarcação)"
                            >
                              <X size={11} /> Não foi
                            </button>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConferenciaFaltas;
