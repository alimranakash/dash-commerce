import type { StockMovementType } from "../inventory.schema";

const badgeStyles: Record<StockMovementType, string> = {
  ADJUSTMENT: "bg-violet-50 text-violet-700 ring-violet-100",
  DAMAGE: "bg-orange-50 text-orange-700 ring-orange-100",
  LOST: "bg-red-50 text-red-700 ring-red-100",
  RETURN: "bg-blue-50 text-blue-700 ring-blue-100",
  STOCK_IN: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  STOCK_OUT: "bg-amber-50 text-amber-700 ring-amber-100"
};

export function StockMovementBadge({ type }: { type: StockMovementType }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${badgeStyles[type]}`}>
      {movementTypeLabel(type)}
    </span>
  );
}

export function movementTypeLabel(type: StockMovementType) {
  return type
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
