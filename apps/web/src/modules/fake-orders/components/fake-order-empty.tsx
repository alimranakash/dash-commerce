import { ShieldCheck } from "lucide-react";

export function FakeOrderEmpty({ title = "No orders found", description = "Risk-reviewed orders will appear here once available." }) {
  return (
    <div className="rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] px-5 py-14 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]">
        <ShieldCheck className="h-7 w-7" />
      </div>
      <h2 className="m-0 mt-4 text-base font-semibold text-[#20212c]">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#74758a]">{description}</p>
    </div>
  );
}
