type MetricCardProps = {
  helper?: string;
  label: string;
  value: string;
};

export function MetricCard({ helper, label, value }: MetricCardProps) {
  return (
    <div className="metric-card analytics-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </div>
  );
}
