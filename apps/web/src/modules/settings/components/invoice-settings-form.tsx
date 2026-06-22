"use client";

import { Bold, Building2, FileText, Image, Italic, List, ReceiptText, RotateCcw, Save, Settings2 } from "lucide-react";
import { useRef, useState, type ComponentType, type FormEvent, type ReactNode } from "react";

const inputClass = "h-12 w-full rounded-lg border border-[#dedcea] bg-white px-3.5 text-sm font-normal text-[#292a34] outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10 disabled:cursor-not-allowed disabled:bg-[#f7f7fa] disabled:text-[#92939e] read-only:bg-[#f7f7fa] read-only:text-[#686a76]";
const textareaClass = "min-h-28 w-full resize-y rounded-lg border border-[#dedcea] bg-white px-3.5 py-3 text-sm font-normal leading-6 text-[#292a34] outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10";

const invoiceOptions = [
  { defaultChecked: true, label: "Show Store Logo", name: "showStoreLogo" },
  { defaultChecked: true, label: "Show Customer Phone", name: "showCustomerPhone" },
  { defaultChecked: true, label: "Show Customer Email", name: "showCustomerEmail" },
  { defaultChecked: true, label: "Show Tax Breakdown", name: "showTaxBreakdown" },
  { defaultChecked: true, label: "Auto Generate Invoice Number", name: "autoGenerateNumber" }
];

export function InvoiceSettingsForm({ storeName, storeUrl }: { storeName: string; storeUrl: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [addressHtml, setAddressHtml] = useState("");
  const [invoicePrefix, setInvoicePrefix] = useState("INV");
  const [startingNumber, setStartingNumber] = useState("1");
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [message, setMessage] = useState("");

  function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Invoice settings are ready to save when invoice storage is connected.");
  }

  function resetSettings() {
    formRef.current?.reset();
    if (editorRef.current) editorRef.current.innerHTML = "";
    setAddressHtml("");
    setInvoicePrefix("INV");
    setStartingNumber("1");
    setTaxEnabled(false);
    setMessage("");
  }

  const previewNumber = `${invoicePrefix.trim().toUpperCase() || "INV"}-${String(Math.max(0, Number(startingNumber) || 0)).padStart(6, "0")}`;

  return (
    <form className="grid gap-5" onSubmit={submitSettings} ref={formRef}>
      {message ? <p className="m-0 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</p> : null}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <InvoiceCard icon={Building2} title="Invoice Information">
          <InvoiceField label="Company / Store Name"><input className={inputClass} defaultValue={storeName} name="companyName" placeholder="Company or store name" type="text" /></InvoiceField>
          <InvoiceField label="Invoice Address Details">
            <RichTextEditor editorRef={editorRef} html={addressHtml} onChange={setAddressHtml} />
            <input name="invoiceAddressHtml" type="hidden" value={addressHtml} />
          </InvoiceField>
          <div className="grid gap-4 sm:grid-cols-2">
            <InvoiceField label="Contact Phone"><input className={inputClass} name="contactPhone" placeholder="+880 1XXX-XXXXXX" type="tel" /></InvoiceField>
            <InvoiceField label="Contact Email"><input className={inputClass} name="contactEmail" placeholder="billing@example.com" type="email" /></InvoiceField>
          </div>
          <InvoiceField label="Website URL"><input className={inputClass} defaultValue={storeUrl} name="websiteUrl" placeholder="https://your-store.com" type="url" /></InvoiceField>
        </InvoiceCard>

        <InvoiceCard icon={ReceiptText} title="Invoice Numbering">
          <InvoiceField label="Invoice Prefix"><input className={inputClass} maxLength={12} name="invoicePrefix" onChange={(event) => setInvoicePrefix(event.target.value)} placeholder="INV" type="text" value={invoicePrefix} /></InvoiceField>
          <InvoiceField label="Starting Invoice Number"><input className={inputClass} min="0" name="startingInvoiceNumber" onChange={(event) => setStartingNumber(event.target.value)} type="number" value={startingNumber} /></InvoiceField>
          <InvoiceField label="Invoice Number Format Preview"><input className={inputClass} readOnly value={previewNumber} /></InvoiceField>
          <div className="rounded-lg border border-[#e5e0f7] bg-[#f7f4ff] px-4 py-3 text-xs leading-5 text-[#6c6380]">Future invoice series and custom numbering formats can extend this section without changing the form layout.</div>
        </InvoiceCard>

        <InvoiceCard icon={Image} title="Invoice Branding">
          <InvoiceField label="Company Logo"><input className={inputClass} name="companyLogoUrl" placeholder="https://cdn.example.com/logo.png" type="url" /></InvoiceField>
          <InvoiceField label="Invoice Footer Note"><textarea className={textareaClass} name="footerNote" placeholder="Payment terms, return policy, or legal footer note" /></InvoiceField>
          <InvoiceField label="Thank You Message"><textarea className={textareaClass} name="thankYouMessage" placeholder="Thank you for shopping with us." /></InvoiceField>
        </InvoiceCard>

        <InvoiceCard icon={FileText} title="Tax & VAT">
          <div className="flex items-center justify-between rounded-lg border border-[#efedf6] bg-[#fcfcff] p-4"><span><strong className="block text-sm">Enable Tax/VAT</strong><span className="mt-1 block text-[11px] text-[#858691]">Include tax details and breakdowns on invoices.</span></span><Toggle checked={taxEnabled} label="Enable Tax/VAT" onChange={setTaxEnabled} /></div>
          <InvoiceField label="VAT Number"><input className={inputClass} disabled={!taxEnabled} name="vatNumber" placeholder="Enter VAT registration number" type="text" /></InvoiceField>
          <div className="grid gap-4 sm:grid-cols-2">
            <InvoiceField label="Tax Label"><input className={inputClass} disabled={!taxEnabled} name="taxLabel" placeholder="VAT" type="text" /></InvoiceField>
            <InvoiceField label="Tax Percentage"><div className="flex h-12 overflow-hidden rounded-lg border border-[#dedcea] bg-white focus-within:border-[#8b5cf6] focus-within:ring-2 focus-within:ring-[#7c3aed]/10"><input className="min-w-0 flex-1 border-0 bg-transparent px-3.5 text-sm outline-none disabled:bg-[#f7f7fa]" disabled={!taxEnabled} min="0" name="taxPercentage" step="0.01" type="number" /><span className="grid min-w-12 place-items-center border-l border-[#e5e3f1] bg-[#fafaff] text-sm text-[#686a76]">%</span></div></InvoiceField>
          </div>
        </InvoiceCard>
      </div>

      <InvoiceCard icon={Settings2} title="Invoice Options">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {invoiceOptions.map((option) => <OptionToggle key={option.name} {...option} />)}
        </div>
      </InvoiceCard>

      <div className="flex flex-wrap justify-end gap-3">
        <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#dcd9e8] bg-white px-4 text-sm font-semibold text-[#555762] hover:bg-[#f8f7fc]" onClick={resetSettings} type="button"><RotateCcw className="h-4 w-4" />Reset</button>
        <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#7548f5] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#6436e8]" type="submit"><Save className="h-4 w-4" />Save Invoice Settings</button>
      </div>
    </form>
  );
}

function InvoiceCard({ children, icon: Icon, title }: { children: ReactNode; icon: ComponentType<{ className?: string }>; title: string }) {
  return <section className="overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]"><header className="flex items-center gap-3 border-b border-[#ececf5] px-5 py-5"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[#f0ebff] text-[#7548f5]"><Icon className="h-5 w-5" /></span><h2 className="m-0 text-sm font-semibold">{title}</h2></header><div className="grid gap-5 p-5">{children}</div></section>;
}

function InvoiceField({ children, label }: { children: ReactNode; label: string }) {
  return <label className="grid gap-2 text-sm font-medium text-[#33343e]">{label}{children}</label>;
}

function RichTextEditor({ editorRef, html, onChange }: { editorRef: React.RefObject<HTMLDivElement | null>; html: string; onChange: (html: string) => void }) {
  function command(name: "bold" | "italic" | "insertUnorderedList") {
    editorRef.current?.focus();
    document.execCommand(name);
    onChange(editorRef.current?.innerHTML ?? html);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#dedcea] bg-white focus-within:border-[#8b5cf6] focus-within:ring-2 focus-within:ring-[#7c3aed]/10">
      <div className="flex gap-1 border-b border-[#e7e5ef] bg-[#fafaff] p-2">
        <EditorButton icon={Bold} label="Bold" onClick={() => command("bold")} />
        <EditorButton icon={Italic} label="Italic" onClick={() => command("italic")} />
        <EditorButton icon={List} label="Bulleted list" onClick={() => command("insertUnorderedList")} />
      </div>
      <div aria-label="Invoice address details" className="min-h-36 px-3.5 py-3 text-sm font-normal leading-6 text-[#292a34] outline-none empty:before:text-[#a2a3b0] empty:before:content-['Enter_company_address,_registration_details,_and_billing_information']" contentEditable onInput={(event) => onChange(event.currentTarget.innerHTML)} ref={editorRef} role="textbox" suppressContentEditableWarning />
    </div>
  );
}

function EditorButton({ icon: Icon, label, onClick }: { icon: ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return <button aria-label={label} className="grid h-8 w-8 place-items-center rounded-md text-[#5f616d] hover:bg-[#eee9ff] hover:text-[#7548f5]" onMouseDown={(event) => event.preventDefault()} onClick={onClick} title={label} type="button"><Icon className="h-4 w-4" /></button>;
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <label className="cursor-pointer"><span className="sr-only">{label}</span><input checked={checked} className="peer sr-only" onChange={(event) => onChange(event.target.checked)} type="checkbox" /><span className="relative block h-5 w-9 rounded-full bg-[#d9d7e3] transition peer-checked:bg-[#7548f5] after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-4" /></label>;
}

function OptionToggle({ defaultChecked, label, name }: { defaultChecked: boolean; label: string; name: string }) {
  return <label className="flex items-center justify-between gap-4 rounded-lg border border-[#efedf6] bg-[#fcfcff] p-4 text-sm font-medium text-[#33343e]"><span>{label}</span><input className="h-4 w-4 accent-[#7548f5]" defaultChecked={defaultChecked} name={name} type="checkbox" /></label>;
}
