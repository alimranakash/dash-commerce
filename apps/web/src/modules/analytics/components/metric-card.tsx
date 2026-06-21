import { BadgeDollarSign, Boxes, Clock3, Package, ShoppingBag, WalletCards } from "lucide-react";

type MetricCardProps = {
  helper?: string;
  index?: number;
  label: string;
  value: string;
};

const styles = [
  { background: "bg-[#fff7ed]", icon: BadgeDollarSign, iconColor: "text-orange-600" },
  { background: "bg-[#fff0fa]", icon: WalletCards, iconColor: "text-fuchsia-600" },
  { background: "bg-[#eaf8ff]", icon: ShoppingBag, iconColor: "text-sky-600" },
  { background: "bg-[#fff0ef]", icon: Clock3, iconColor: "text-rose-500" },
  { background: "bg-[#eef9ec]", icon: Package, iconColor: "text-emerald-600" },
  { background: "bg-[#f2efff]", icon: Boxes, iconColor: "text-violet-600" }
];

export function MetricCard({ helper, index = 0, label, value }: MetricCardProps) {
  const style = styles[index % styles.length] ?? styles[0]!;
  const Icon = style.icon;

  return (
    <div className={`min-h-[92px] rounded-lg p-4 ${style.background}`}>
      <div className="flex items-center gap-2 text-[11px] font-medium text-[#50515d]">
        <Icon className={`h-4 w-4 ${style.iconColor}`} />
        <span>{label}</span>
      </div>
      <strong className="mt-3 block text-lg font-bold text-[#15161d]">{value}</strong>
      {helper ? <small className="mt-1 block text-[10px] text-[#858691]">{helper}</small> : null}
    </div>
  );
}
