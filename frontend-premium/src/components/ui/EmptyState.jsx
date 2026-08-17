import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * Estado vazio padronizado — substitui os "Nenhum dado encontrado" crus.
 * Uso:
 *   <EmptyState icon={Inbox} title="Sem dados neste período"
 *     hint="Tente outro mês ou faça um upload."
 *     action={{ label: 'Calcular pagamentos', onClick: () => nav('/calcular-pagamentos') }} />
 */
const EmptyState = ({ icon: Icon = Inbox, title, hint, action }) => (
  <div className="empty-state">
    <div className="empty-state-icon">
      <Icon size={26} />
    </div>
    {title && <div className="empty-state-title">{title}</div>}
    {hint && <div className="empty-state-hint">{hint}</div>}
    {action && (
      <button className="empty-state-action" onClick={action.onClick}>
        {action.label}
      </button>
    )}
  </div>
);

export default EmptyState;
