import React from 'react';

/**
 * Skeleton loaders — substituem os textos "Carregando...".
 * Uso:
 *   <Skeleton width="60%" height={16} />
 *   <Skeleton.Card />
 *   <Skeleton.Stat />
 *   <Skeleton.Row cols={5} />
 *   <Skeleton.Table rows={5} cols={5} />
 */
const Skeleton = ({ width = '100%', height = 14, radius, style, className = '' }) => (
  <div
    className={`skeleton ${className}`}
    style={{
      width,
      height: typeof height === 'number' ? `${height}px` : height,
      borderRadius: radius,
      ...style,
    }}
  />
);

Skeleton.Text = ({ width = '100%', lines = 1 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} width={i === lines - 1 && lines > 1 ? '70%' : width} height={12} />
    ))}
  </div>
);

Skeleton.Card = ({ height = 120 }) => (
  <div className="skeleton-card">
    <Skeleton width="40%" height={12} />
    <div style={{ height: 12 }} />
    <Skeleton width="70%" height={24} />
    <div style={{ height: 16 }} />
    <Skeleton width="100%" height={height - 80} />
  </div>
);

Skeleton.Stat = () => (
  <div className="skeleton-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
    <Skeleton width={44} height={44} radius="var(--radius-md)" />
    <div style={{ flex: 1 }}>
      <Skeleton width="50%" height={22} />
      <div style={{ height: 8 }} />
      <Skeleton width="70%" height={12} />
    </div>
  </div>
);

Skeleton.Row = ({ cols = 4 }) => (
  <div className="skeleton-row">
    {Array.from({ length: cols }).map((_, i) => (
      <Skeleton key={i} width={i === 0 ? '24%' : `${Math.floor(76 / (cols - 1))}%`} height={14} />
    ))}
  </div>
);

Skeleton.Table = ({ rows = 5, cols = 4 }) => (
  <div>
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton.Row key={i} cols={cols} />
    ))}
  </div>
);

export default Skeleton;
