import React, { useMemo, useState } from 'react';
import {
  CalendarX, CalendarCheck, PartyPopper, ArrowLeftRight,
  Check, X, ChevronDown, ChevronRight,
} from 'lucide-react';
import '../styles/FaltasConferencia.css';

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const MOTIVOS = {
  feriado: { label: 'Feriado', Icone: PartyPopper, classe: 'motivo--feriado' },
  atendeu_outro_turno: { label: 'Atendeu no outro turno', Icone: ArrowLeftRight, classe: 'motivo--troca' },
  fora_da_vigencia: { label: 'Fora da vigência', Icone: CalendarCheck, classe: 'motivo--vigencia' },
  sem_motivo: { label: 'Sem justificativa', Icone: CalendarX, classe: 'motivo--suspeita' },
};

/** "2026-07-31" → "31/07 (sex)". Monta em UTC para não escorregar de dia. */
function formatarDia(iso) {
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} (${DIAS_SEMANA[data.getUTCDay()]})`;
}

const chaveDia = (vinculoId, data) => `${vinculoId}|${data}`;

/**
 * Conferência das faltas prováveis detectadas na planilha.
 *
 * O detector é uma TRIAGEM: ele lista os dias em que a unidade abriu no turno
 * contratado e o profissional não atendeu ninguém. Confirmar é sempre decisão
 * humana — a planilha não sabe separar falta de férias, atestado ou folga.
 */
const FaltasConferencia = ({ grupos, onChange }) => {
  const [abertos, setAbertos] = useState({});
  // chave dia -> 'confirmada' | 'descartada'. Ausente = ainda suspeita.
  const [decisoes, setDecisoes] = useState({});

  const alternar = (id) => setAbertos(p => ({ ...p, [id]: !p[id] }));

  const decidir = (vinculoId, data, status) => {
    setDecisoes(prev => {
      const k = chaveDia(vinculoId, data);
      const novo = { ...prev };
      if (novo[k] === status) delete novo[k]; // clicar de novo desfaz
      else novo[k] = status;
      onChange?.(novo);
      return novo;
    });
  };

  const confirmarTodasSemMotivo = (grupo) => {
    setDecisoes(prev => {
      const novo = { ...prev };
      grupo.dias
        .filter(d => d.motivo === 'sem_motivo')
        .forEach(d => { novo[chaveDia(grupo.vinculo_id, d.data)] = 'confirmada'; });
      onChange?.(novo);
      return novo;
    });
  };

  const totais = useMemo(() => {
    const vals = Object.values(decisoes);
    return {
      confirmadas: vals.filter(v => v === 'confirmada').length,
      descartadas: vals.filter(v => v === 'descartada').length,
      pendentes: grupos.reduce((s, g) => s + g.dias.filter(d => d.motivo !== 'feriado').length, 0)
        - vals.length,
    };
  }, [decisoes, grupos]);

  if (!grupos?.length) {
    return (
      <div className="faltas-vazio">
        <CalendarCheck size={20} />
        <span>Nenhuma ausência detectada neste período.</span>
      </div>
    );
  }

  return (
    <div className="faltas-conf">
      <div className="faltas-conf-head">
        <div>
          <h3>Faltas prováveis</h3>
          <p>
            Dias em que a unidade abriu no turno contratado e não houve nenhum atendimento.
            É uma triagem — <strong>nada é descontado</strong> até você confirmar.
          </p>
        </div>
        <div className="faltas-conf-totais">
          <span className="ui-chip ui-chip--warn">{totais.pendentes} a revisar</span>
          <span className="ui-chip ui-chip--success">{totais.confirmadas} confirmadas</span>
          <span className="ui-chip">{totais.descartadas} descartadas</span>
        </div>
      </div>

      <div className="faltas-lista">
        {grupos.map(grupo => {
          const aberto = abertos[grupo.vinculo_id];
          const semMotivo = grupo.dias.filter(d => d.motivo === 'sem_motivo').length;
          const feriados = grupo.dias.filter(d => d.motivo === 'feriado').length;

          return (
            <div key={grupo.vinculo_id} className="falta-grupo">
              <button
                className="falta-grupo-head"
                onClick={() => alternar(grupo.vinculo_id)}
                aria-expanded={!!aberto}
              >
                {aberto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className="falta-nome">{grupo.nome}</span>
                <span className="falta-meta">
                  {grupo.especialidade} · {grupo.unidade} · {grupo.turno}
                </span>
                <span className="falta-badges">
                  {semMotivo > 0 && (
                    <span className="ui-chip ui-chip--attention">{semMotivo} sem justificativa</span>
                  )}
                  {feriados > 0 && <span className="ui-chip">{feriados} feriado</span>}
                </span>
              </button>

              {aberto && (
                <div className="falta-dias">
                  {semMotivo > 1 && (
                    <button
                      className="ui-btn-mini ui-btn-mini--outline falta-bulk"
                      onClick={() => confirmarTodasSemMotivo(grupo)}
                    >
                      <Check size={12} /> Confirmar as {semMotivo} sem justificativa
                    </button>
                  )}

                  {grupo.dias.map(d => {
                    const info = MOTIVOS[d.motivo] || MOTIVOS.sem_motivo;
                    const { Icone } = info;
                    const decisao = decisoes[chaveDia(grupo.vinculo_id, d.data)];
                    const ehFeriado = d.motivo === 'feriado';

                    return (
                      <div key={d.data} className={`falta-dia ${decisao ? `dia--${decisao}` : ''}`}>
                        <span className="falta-dia-data">{formatarDia(d.data)}</span>
                        <span className={`falta-dia-motivo ${info.classe}`}>
                          <Icone size={13} />
                          {ehFeriado && d.feriado_nome ? d.feriado_nome : info.label}
                        </span>

                        {ehFeriado ? (
                          <span className="falta-dia-nota">não conta</span>
                        ) : (
                          <span className="falta-dia-acoes">
                            <button
                              className={`ui-btn-mini ${decisao === 'confirmada' ? 'ui-btn-mini--danger' : 'ui-btn-mini--outline'}`}
                              onClick={() => decidir(grupo.vinculo_id, d.data, 'confirmada')}
                              title="Foi falta mesmo — entra no cálculo"
                            >
                              <Check size={11} /> Faltou
                            </button>
                            <button
                              className={`ui-btn-mini ${decisao === 'descartada' ? 'ui-btn-mini--success' : 'ui-btn-mini--outline'}`}
                              onClick={() => decidir(grupo.vinculo_id, d.data, 'descartada')}
                              title="Não foi falta (férias, atestado, folga, sem agenda)"
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

export default FaltasConferencia;
