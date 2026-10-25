import type { NoteColor } from "../note.schema";

/**
 * Every class is written out whole, so Tailwind and `npm run theme:dark` both
 * find it — a colour assembled from parts would ship unstyled in either theme.
 */
export const NOTE_COLOR_STYLES: Record<
  NoteColor,
  { name: string; surface: string; swatch: string }
> = {
  default: { name: "Default", surface: "border-[#ececf5] bg-white", swatch: "bg-white" },
  red: { name: "Red", surface: "border-[#fecaca] bg-[#fee2e2]", swatch: "bg-[#fee2e2]" },
  orange: { name: "Orange", surface: "border-[#fed7aa] bg-[#ffedd5]", swatch: "bg-[#ffedd5]" },
  yellow: { name: "Yellow", surface: "border-[#fde68a] bg-[#fef9c3]", swatch: "bg-[#fef9c3]" },
  green: { name: "Green", surface: "border-[#bbf7d0] bg-[#dcfce7]", swatch: "bg-[#dcfce7]" },
  teal: { name: "Teal", surface: "border-[#99f6e4] bg-[#ccfbf1]", swatch: "bg-[#ccfbf1]" },
  blue: { name: "Blue", surface: "border-[#bfdbfe] bg-[#dbeafe]", swatch: "bg-[#dbeafe]" },
  purple: { name: "Purple", surface: "border-[#ddd6fe] bg-[#ede9fe]", swatch: "bg-[#ede9fe]" },
  pink: { name: "Pink", surface: "border-[#fbcfe8] bg-[#fce7f3]", swatch: "bg-[#fce7f3]" }
};
