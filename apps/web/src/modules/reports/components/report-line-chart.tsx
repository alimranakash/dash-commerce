type ChartSeries = {
  color: string;
  label: string;
  values: number[];
};

export function ReportLineChart({ labels, series }: { labels: string[]; series: ChartSeries[] }) {
  const max = Math.max(1, ...series.flatMap((entry) => entry.values));

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap justify-center gap-4">
        {series.map((entry) => (
          <span className="inline-flex items-center gap-1.5 text-[10px] text-[#777985]" key={entry.label}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} /> {entry.label}
          </span>
        ))}
      </div>
      <svg aria-label="Report trend chart" className="h-48 w-full overflow-visible" preserveAspectRatio="none" role="img" viewBox="0 0 1000 210">
        {[25, 65, 105, 145, 185].map((y) => <line key={y} stroke="#efeff5" strokeWidth="1" x1="0" x2="1000" y1={y} y2={y} />)}
        {series.map((entry) => (
          <polyline
            fill="none"
            key={entry.label}
            points={entry.values.map((value, index) => `${pointX(index, entry.values.length)},${185 - (value / max) * 155}`).join(" ")}
            stroke={entry.color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        ))}
        {series.flatMap((entry) => entry.values.map((value, index) => (
          <circle cx={pointX(index, entry.values.length)} cy={185 - (value / max) * 155} fill={entry.color} key={`${entry.label}-${index}`} r="2.5" />
        )))}
      </svg>
      <div className="mt-1 grid grid-cols-6 text-[9px] text-[#92939d]">
        {labelSamples(labels).map((label) => <span key={label}>{label}</span>)}
      </div>
    </div>
  );
}

function pointX(index: number, length: number) {
  return length <= 1 ? 0 : (index / (length - 1)) * 1000;
}

function labelSamples(labels: string[]) {
  if (labels.length <= 6) return labels;
  return Array.from({ length: 6 }, (_, index) => labels[Math.round(index * (labels.length - 1) / 5)] ?? "");
}
