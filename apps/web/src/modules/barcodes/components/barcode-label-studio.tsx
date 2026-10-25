"use client";

import { AlertTriangle, ImageIcon, Printer, ScanLine } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { assignMissingBarcodesAction } from "../barcode.actions";
import {
  barHeightMm,
  formatLabelPrice,
  LABEL_PRESETS,
  labelLayout,
  MIN_BAR_HEIGHT_MM,
  MIN_MODULE_MM,
  paginateLabels,
  resolveLabelSize,
  type LabelFields,
  type LabelPresetId
} from "../barcode-label.layout";
import {
  DEFAULT_LABEL_SETTINGS,
  labelSettingsSchema,
  MAX_LABEL_COPIES,
  MAX_LABEL_PRODUCTS,
  MAX_LABELS_PER_RUN,
  normalizeBarcodeValue,
  type LabelSettings
} from "../barcode.schema";
import { buildScanIndex, lookupScan } from "../barcode.scan";
import { encodeBarcode } from "../barcode.symbology";
import { BarcodeLabel, type BarcodeLabelData } from "./barcode-label";
import { BarcodePrintSheet } from "./barcode-print-sheet";

/**
 * One row of the label page: a product sold as itself, or one option of a
 * product sold by size, colour and the like. Each has its own barcode, price
 * and stock, so each gets its own label.
 */
export type LabelStudioItem = {
  barcode: string | null;
  imageUrl: string | null;
  /** `p:<productId>` or `v:<variantId>`. */
  key: string;
  price: string;
  productId: string;
  sku: string | null;
  stockQuantity: number;
  title: string;
  /** The label's option line, "Color: Black · Size: M"; null for a plain product. */
  variant: string | null;
  variantId: string | null;
  /** How the row names the option, "Black / M". */
  variantTitle: string | null;
};

type BarcodeLabelStudioProps = {
  currency: string;
  /** Product ids from `?ids=`; a product sold by option starts with all of its options. */
  initialSelection: string[];
  items: LabelStudioItem[];
  storeName: string;
};

type Notice = { message: string; tone: "error" | "ok" };

type ItemGroup = { items: LabelStudioItem[]; productId: string; byVariant: boolean };

const SETTINGS_KEY = "storeim.barcode-labels.v1";
const SAMPLE_LABEL: BarcodeLabelData = {
  barcode: "2000000000008",
  price: "",
  sku: "SKU-001",
  title: "Sample product",
  variant: null
};

/**
 * The label page: choose what to label and how many of each, choose the stock
 * in the printer, check the preview, print.
 *
 * Printing is also what gives a product or a variant its barcode. Rows without
 * one are sent to `assignMissingBarcodesAction` first and their new codes laid
 * over this page's own list, so the number on every sticker is already saved —
 * and already what the sale form's scanner looks up — before the print dialog
 * opens.
 */
export function BarcodeLabelStudio({ currency, initialSelection, items: initialItems, storeName }: BarcodeLabelStudioProps) {
  const [items, setItems] = useState(initialItems);
  const [copies, setCopies] = useState<Record<string, number>>(() => initialCopies(initialItems, initialSelection));
  const [settings, setSettings] = useState<LabelSettings>(DEFAULT_LABEL_SETTINGS);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [printJob, setPrintJob] = useState<number | null>(null);

  // Per-device settings arrive after hydration, so the server's render and the
  // first client render agree.
  useEffect(() => {
    const stored = readStoredSettings();

    if (stored) {
      setSettings(stored);
    }
  }, []);

  useEffect(() => {
    if (printJob === null) {
      return;
    }

    // One frame for the sheet to lay out before the dialog snapshots it.
    const frame = window.requestAnimationFrame(() => window.print());
    const finish = () => setPrintJob(null);

    window.addEventListener("afterprint", finish, { once: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", finish);
    };
  }, [printJob]);

  const scanIndex = useMemo(
    () => buildScanIndex(items.map((item) => ({ barcode: item.barcode, id: item.key, sku: item.sku }))),
    [items]
  );
  const size = resolveLabelSize(settings);
  const fields: LabelFields = {
    barcodeText: settings.showBarcodeText,
    company: settings.showCompany,
    name: settings.showName,
    price: settings.showPrice,
    sku: settings.showSku,
    variant: settings.showVariant
  };
  const companyName = settings.companyName.trim() || storeName;
  const selected = items.filter((item) => (copies[item.key] ?? 0) > 0);
  // The tightest label in the run decides the warnings: one with an option line.
  const layout = labelLayout(size, { ...fields, variant: fields.variant && selected.some((item) => item.variant) });
  const labels = selected.flatMap((item) =>
    Array.from({ length: copies[item.key] ?? 0 }, () => toLabelData(item, currency))
  );
  const pageCount = paginateLabels(labels.length, size.sheet, settings.skip).length;
  const missingCount = selected.filter((item) => !item.barcode).length;
  const query = search.trim().toLowerCase();
  const visible = query
    ? items.filter((item) =>
        [item.title, item.variantTitle ?? "", item.sku ?? "", item.barcode ?? ""].some((text) =>
          text.toLowerCase().includes(query)
        )
      )
    : items;
  const groups = groupItems(visible);
  const previewItem = selected[0] ?? items[0];
  const previewLabel = previewItem
    ? toLabelData(previewItem, currency)
    : { ...SAMPLE_LABEL, price: formatLabelPrice("250", currency) };
  const previewZoom = Math.min(Math.max(320 / (size.widthMm * 3.78), 1), 2.6);
  const denseItems = selected.filter((item) => {
    if (!item.barcode) {
      return false;
    }

    try {
      return layout.barcode.widthMm / encodeBarcode(item.barcode).totalModules < MIN_MODULE_MM;
    } catch {
      return false;
    }
  });
  const barsTooShort = barHeightMm(layout) < MIN_BAR_HEIGHT_MM;
  const tooMany = labels.length > MAX_LABELS_PER_RUN || selected.length > MAX_LABEL_PRODUCTS;

  function updateSettings(patch: Partial<LabelSettings>) {
    const next = labelSettingsSchema.parse({ ...settings, ...patch });

    setSettings(next);
    writeStoredSettings(next);
  }

  function setItemCopies(keys: string[], value: number) {
    setCopies((current) => {
      const next = { ...current };

      for (const key of keys) {
        if (value > 0) {
          next[key] = Math.min(Math.trunc(value), MAX_LABEL_COPIES);
        } else {
          delete next[key];
        }
      }

      return next;
    });
  }

  function selectVisible() {
    setCopies((current) => {
      const next = { ...current };

      for (const item of visible) {
        next[item.key] ??= 1;
      }

      return next;
    });
  }

  function copiesFromStock() {
    setCopies((current) =>
      Object.fromEntries(
        Object.keys(current).map((key) => {
          const item = items.find((entry) => entry.key === key);

          return [key, Math.min(Math.max(item?.stockQuantity ?? 1, 1), MAX_LABEL_COPIES)];
        })
      )
    );
  }

  /** A scanner pointed at a box adds one more of that product's — or that size's — label. */
  function addOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    const match = lookupScan(scanIndex, search);
    const item = match ? items.find((entry) => entry.key === match.id) : undefined;

    if (!item) {
      setNotice(
        search.trim()
          ? { message: `Nothing here has the barcode or SKU "${normalizeBarcodeValue(search)}".`, tone: "error" }
          : null
      );
      return;
    }

    const count = Math.min((copies[item.key] ?? 0) + 1, MAX_LABEL_COPIES);

    setItemCopies([item.key], count);
    setSearch("");
    setNotice({ message: `${itemName(item)} — ${count} label${count === 1 ? "" : "s"}.`, tone: "ok" });
  }

  async function print() {
    if (!labels.length || tooMany || assigning) {
      return;
    }

    setNotice(null);

    const missing = selected.filter((item) => !item.barcode);

    if (missing.length) {
      setAssigning(true);

      const result = await assignMissingBarcodesAction({
        productIds: missing.flatMap((item) => (item.variantId ? [] : [item.productId])),
        variantIds: missing.flatMap((item) => (item.variantId ? [item.variantId] : []))
      });

      setAssigning(false);

      if (result.status === "error") {
        setNotice({ message: result.message, tone: "error" });
        return;
      }

      setItems((current) =>
        current.map((item) => {
          const barcode = item.variantId
            ? result.variantBarcodes[item.variantId]
            : result.productBarcodes[item.productId];

          return barcode ? { ...item, barcode } : item;
        })
      );

      if (result.assigned) {
        setNotice({
          message: `${result.assigned} new barcode${result.assigned === 1 ? "" : "s"} assigned and saved, so the sale page can scan ${result.assigned === 1 ? "it" : "them"}.`,
          tone: "ok"
        });
      }
    }

    setPrintJob(Date.now());
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      {/* `content-start`: `.panel-card` is a grid, and beside the taller settings column its rows would otherwise stretch to fill it. */}
      <section className="panel-card min-w-0 content-start p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-base font-semibold text-[#20212c]">Products</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <button className="rounded-lg border border-[#ddd6fe] px-3 py-2 font-semibold text-[#6d3cf5]" onClick={selectVisible} type="button">
              Select all shown
            </button>
            <button className="rounded-lg border border-[#ddd6fe] px-3 py-2 font-semibold text-[#6d3cf5] disabled:opacity-50" disabled={!selected.length} onClick={copiesFromStock} title="One label for every unit in stock" type="button">
              Copies = stock
            </button>
            <button className="rounded-lg border border-[#e6e6ee] px-3 py-2 font-semibold text-[#5e606b] disabled:opacity-50" disabled={!selected.length} onClick={() => setCopies({})} type="button">
              Clear
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-lg border border-[#e3e1ef] bg-white px-3">
          <ScanLine aria-hidden="true" className="h-4 w-4 shrink-0 text-[#7c3aed]" />
          <input
            aria-label="Search products, or scan a barcode to add its label"
            autoComplete="off"
            className="h-10 w-full border-0 bg-transparent text-sm outline-none"
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={addOnEnter}
            placeholder="Search by name, option, SKU or barcode — or scan an item to add its label"
            spellCheck={false}
            type="search"
            value={search}
          />
        </label>

        {notice ? (
          <p className={notice.tone === "error" ? "form-error" : "success-message"} role="status">
            {notice.message}
          </p>
        ) : null}

        <div className="max-h-[640px] overflow-auto rounded-lg border border-[#efeff5]">
          {groups.length ? (
            // Fixed layout, so a long name truncates instead of widening the
            // table and pushing Copies out of sight behind a sideways scroll.
            <table className="w-full min-w-[480px] table-fixed border-collapse text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-[#f8f8fb] text-xs font-semibold text-[#555762]">
                <tr>
                  <th className="w-11 px-3 py-2.5"><span className="sr-only">Print</span></th>
                  <th className="px-3 py-2.5">Product</th>
                  <th className="w-24 px-3 py-2.5">Price</th>
                  <th className="w-16 px-3 py-2.5">Stock</th>
                  <th className="w-[104px] px-3 py-2.5">Copies</th>
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.productId}>
                  {group.byVariant ? (
                    <GroupRow
                      copies={copies}
                      group={group}
                      onToggle={(checked) => setItemCopies(group.items.map((item) => item.key), checked ? 1 : 0)}
                    />
                  ) : null}
                  {group.items.map((item) => (
                    <ItemRow
                      count={copies[item.key] ?? 0}
                      currency={currency}
                      indented={group.byVariant}
                      item={item}
                      key={item.key}
                      onCopies={(value) => setItemCopies([item.key], value)}
                    />
                  ))}
                </tbody>
              ))}
            </table>
          ) : (
            <p className="m-0 px-4 py-10 text-center text-sm text-[#74758a]">
              {items.length ? "Nothing matches that search." : "Add a product first — labels are printed from your catalogue."}
            </p>
          )}
        </div>
      </section>

      <aside className="grid content-start gap-5">
        <section className="panel-card p-4 sm:p-5">
          <h2 className="m-0 text-base font-semibold text-[#20212c]">Label</h2>
          <div className="grid gap-3 text-sm">
            <label className="grid gap-1.5 text-xs font-semibold text-[#565762]">
              Label stock
              <select
                className="h-10 rounded-lg border border-[#e3e1ef] bg-white px-3 text-sm font-normal text-[#30313d]"
                onChange={(event) => updateSettings({ preset: event.target.value as LabelPresetId })}
                value={settings.preset}
              >
                <optgroup label="Thermal label printer (roll)">
                  {LABEL_PRESETS.filter((preset) => preset.sheet.kind === "roll").map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Office printer (A4 sticker sheet)">
                  {LABEL_PRESETS.filter((preset) => preset.sheet.kind === "sheet").map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            {settings.preset === "roll-custom" ? (
              <div className="grid grid-cols-2 gap-3">
                <NumberSetting label="Width (mm)" max={110} min={25} onChange={(value) => updateSettings({ customWidthMm: value })} value={settings.customWidthMm} />
                <NumberSetting label="Height (mm)" max={100} min={15} onChange={(value) => updateSettings({ customHeightMm: value })} value={settings.customHeightMm} />
              </div>
            ) : null}
            {size.sheet.kind === "sheet" ? (
              <NumberSetting
                hint="Labels already used on the first sheet — printing starts after them."
                label="Skip labels"
                max={size.sheet.columns * size.sheet.rows - 1}
                min={0}
                onChange={(value) => updateSettings({ skip: value })}
                value={settings.skip}
              />
            ) : null}
            <label className="grid gap-1.5 text-xs font-semibold text-[#565762]">
              Company name
              <input
                className="h-10 rounded-lg border border-[#e3e1ef] px-3 text-sm font-normal text-[#30313d]"
                maxLength={60}
                onChange={(event) => updateSettings({ companyName: event.target.value })}
                placeholder={storeName}
                type="text"
                value={settings.companyName}
              />
            </label>
            <fieldset className="m-0 grid grid-cols-2 gap-2 border-0 p-0">
              <legend className="mb-1.5 text-xs font-semibold text-[#565762]">Print on the label</legend>
              <ToggleSetting checked={settings.showCompany} label="Company name" onChange={(value) => updateSettings({ showCompany: value })} />
              <ToggleSetting checked={settings.showName} label="Product name" onChange={(value) => updateSettings({ showName: value })} />
              <ToggleSetting checked={settings.showVariant} label="Size, colour…" onChange={(value) => updateSettings({ showVariant: value })} />
              <ToggleSetting checked={settings.showPrice} label="Price" onChange={(value) => updateSettings({ showPrice: value })} />
              <ToggleSetting checked={settings.showSku} label="SKU" onChange={(value) => updateSettings({ showSku: value })} />
              <ToggleSetting checked={settings.showBarcodeText} label="Barcode number" onChange={(value) => updateSettings({ showBarcodeText: value })} />
            </fieldset>
          </div>
        </section>

        <section className="panel-card p-4 sm:p-5">
          <h2 className="m-0 text-base font-semibold text-[#20212c]">Preview</h2>
          <div className="grid place-items-center overflow-hidden rounded-lg border border-[#ececf5] bg-[#f4f4f8] p-4">
            <div className="shadow-[0_2px_10px_rgba(20,20,40,0.18)]" style={{ zoom: previewZoom }}>
              <BarcodeLabel companyName={companyName} fields={fields} label={previewLabel} size={size} />
            </div>
          </div>
          <p className="m-0 text-xs text-[#74758a]">
            Actual size {size.widthMm} × {size.heightMm} mm, shown enlarged.
          </p>

          {denseItems.length ? (
            <Warning>
              The bars of {listNames(denseItems)} come out thinner than {MIN_MODULE_MM} mm on this label, which some scanners
              misread. Use a wider label, or give {denseItems.length === 1 ? "it" : "them"} a shorter barcode.
            </Warning>
          ) : null}
          {barsTooShort ? (
            <Warning>
              The bars are only {Math.max(barHeightMm(layout), 0).toFixed(1)} mm tall. Turn off a line above, or choose a taller label.
            </Warning>
          ) : null}
          {tooMany ? (
            <Warning>
              Print at most {MAX_LABELS_PER_RUN} labels from {MAX_LABEL_PRODUCTS} rows at a time — split this run in two.
            </Warning>
          ) : null}

          <div className="grid gap-2 border-t border-[#ececf5] pt-4">
            <p className="m-0 text-sm text-[#30313d]">
              {labels.length
                ? `${labels.length} label${labels.length === 1 ? "" : "s"} from ${selected.length} item${selected.length === 1 ? "" : "s"}${size.sheet.kind === "sheet" ? ` · ${pageCount} A4 sheet${pageCount === 1 ? "" : "s"}` : ""}`
                : "Tick the products or options to print, or scan them into the search box."}
            </p>
            {missingCount ? (
              <p className="m-0 text-xs text-[#74758a]">
                {missingCount} of these {missingCount === 1 ? "has" : "have"} no barcode yet. Printing gives{" "}
                {missingCount === 1 ? "it" : "each"} a new one and saves it.
              </p>
            ) : null}
            <button
              className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-4 text-sm font-semibold text-white transition hover:bg-[#6d28d9] disabled:opacity-60"
              disabled={!labels.length || tooMany || assigning}
              onClick={() => void print()}
              type="button"
            >
              <Printer aria-hidden="true" className="h-4 w-4" />
              {assigning ? "Assigning barcodes…" : `Print ${labels.length || ""} label${labels.length === 1 ? "" : "s"}`}
            </button>
            <p className="m-0 text-xs leading-relaxed text-[#74758a]">
              {size.sheet.kind === "roll"
                ? `In the print dialog choose your label printer, set the paper size to ${size.widthMm} × ${size.heightMm} mm, margins to None and scale to 100%.`
                : "In the print dialog choose A4, margins None and scale 100% (Actual size), so the grid lands on the die-cut stickers."}
            </p>
          </div>
        </section>
      </aside>

      {printJob !== null ? (
        <BarcodePrintSheet companyName={companyName} fields={fields} labels={labels} size={size} skip={settings.skip} />
      ) : null}
    </div>
  );
}

/** A product sold by option: one box ticks every option shown beneath it. */
function GroupRow({
  copies,
  group,
  onToggle
}: {
  copies: Record<string, number>;
  group: ItemGroup;
  onToggle: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const first = group.items[0];
  const chosen = group.items.filter((item) => (copies[item.key] ?? 0) > 0).length;
  const all = chosen === group.items.length;

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = chosen > 0 && !all;
    }
  }, [all, chosen]);

  if (!first) {
    return null;
  }

  return (
    <tr className="border-t border-[#eeeef5] bg-[#fbfbfd] text-[#30313d]">
      <td className="px-3 py-2">
        <input
          aria-label={`Print labels for every option of ${first.title}`}
          checked={all}
          className="h-4 w-4 accent-[#7c3aed]"
          onChange={(event) => onToggle(event.target.checked)}
          ref={ref}
          type="checkbox"
        />
      </td>
      <td className="px-3 py-2" colSpan={4}>
        <div className="flex min-w-0 items-center gap-3">
          <Thumbnail url={first.imageUrl} />
          <div className="min-w-0">
            <span className="block truncate font-medium">{first.title}</span>
            <span className="block truncate text-[11px] text-[#7a7b88]">
              {group.items.length} option{group.items.length === 1 ? "" : "s"} · {chosen} selected — each has its own barcode
            </span>
          </div>
        </div>
      </td>
    </tr>
  );
}

function ItemRow({
  count,
  currency,
  indented,
  item,
  onCopies
}: {
  count: number;
  currency: string;
  indented: boolean;
  item: LabelStudioItem;
  onCopies: (value: number) => void;
}) {
  const name = itemName(item);

  return (
    <tr className="border-t border-[#eeeef5] text-[#30313d]">
      <td className="px-3 py-2">
        <input
          aria-label={`Print labels for ${name}`}
          checked={count > 0}
          className="h-4 w-4 accent-[#7c3aed]"
          onChange={(event) => onCopies(event.target.checked ? 1 : 0)}
          type="checkbox"
        />
      </td>
      <td className="px-3 py-2">
        <div className={`flex min-w-0 items-center gap-3 ${indented ? "pl-6" : ""}`}>
          {indented ? null : <Thumbnail url={item.imageUrl} />}
          <div className="min-w-0">
            <span className="block truncate font-medium">{indented ? item.variantTitle : item.title}</span>
            <span className="block truncate font-mono text-[11px] text-[#7a7b88]">
              {item.barcode ?? <span className="font-sans italic">No barcode yet — assigned when printed</span>}
              {item.sku ? <span className="font-sans"> · SKU {item.sku}</span> : null}
            </span>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2">{formatLabelPrice(item.price, currency)}</td>
      <td className={`px-3 py-2 ${item.stockQuantity <= 0 ? "text-[#a3203a]" : "text-[#5e606b]"}`}>{item.stockQuantity}</td>
      <td className="px-3 py-2">
        <input
          aria-label={`Copies of ${name}`}
          className="h-9 w-20 rounded-lg border border-[#e3e1ef] px-2 text-sm disabled:opacity-40"
          disabled={count === 0}
          max={MAX_LABEL_COPIES}
          min={1}
          onChange={(event) => onCopies(Math.max(Number(event.target.value) || 1, 1))}
          type="number"
          value={count || 1}
        />
      </td>
    </tr>
  );
}

function Thumbnail({ url }: { url: string | null }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md border border-[#ecebf2] bg-[#fafafa]">
      {url ? <img alt="" className="h-full w-full object-cover" src={url} /> : <ImageIcon className="h-4 w-4 text-[#b6b7c0]" />}
    </span>
  );
}

function NumberSetting({
  hint,
  label,
  max,
  min,
  onChange,
  value
}: {
  hint?: string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  // What is being typed, which may pass through an out-of-range "5" on the way
  // to "50"; only a value in range is committed, and leaving the box shows it.
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <label className="grid gap-1.5 text-xs font-semibold text-[#565762]">
      {label}
      <input
        className="h-10 rounded-lg border border-[#e3e1ef] px-3 text-sm font-normal text-[#30313d]"
        max={max}
        min={min}
        onBlur={() => setDraft(null)}
        onChange={(event) => {
          const text = event.target.value;
          const next = Number(text);

          setDraft(text);

          if (text !== "" && Number.isFinite(next) && next >= min && next <= max) {
            onChange(next);
          }
        }}
        step={label.includes("mm") ? 0.5 : 1}
        type="number"
        value={draft ?? String(value)}
      />
      {hint ? <small className="font-normal text-[#74758a]">{hint}</small> : null}
    </label>
  );
}

function ToggleSetting({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-[#30313d]">
      <input checked={checked} className="h-4 w-4 accent-[#7c3aed]" onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      {label}
    </label>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Rows in catalogue order, a product's options kept together under it. */
function groupItems(items: LabelStudioItem[]) {
  const groups: ItemGroup[] = [];
  const byProduct = new Map<string, ItemGroup>();

  for (const item of items) {
    const group = byProduct.get(item.productId);

    if (group) {
      group.items.push(item);
      continue;
    }

    const next: ItemGroup = { byVariant: Boolean(item.variantId), items: [item], productId: item.productId };

    byProduct.set(item.productId, next);
    groups.push(next);
  }

  return groups;
}

function itemName(item: LabelStudioItem) {
  return item.variantTitle ? `${item.title} - ${item.variantTitle}` : item.title;
}

function toLabelData(item: LabelStudioItem, currency: string): BarcodeLabelData {
  return {
    barcode: item.barcode,
    price: formatLabelPrice(item.price, currency),
    sku: item.sku,
    title: item.title,
    variant: item.variant
  };
}

function initialCopies(items: LabelStudioItem[], productIds: string[]) {
  const wanted = new Set(productIds);

  return Object.fromEntries(items.filter((item) => wanted.has(item.productId)).map((item) => [item.key, 1]));
}

function listNames(items: LabelStudioItem[]) {
  const names = items.slice(0, 3).map((item) => `“${itemName(item)}”`);

  return items.length > 3 ? `${names.join(", ")} and ${items.length - 3} more` : names.join(" and ");
}

/** Browser storage can be missing or refuse; the defaults are always a working answer. */
function readStoredSettings(): LabelSettings | null {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;

    return parsed && typeof parsed === "object" ? labelSettingsSchema.parse(parsed) : null;
  } catch {
    return null;
  }
}

function writeStoredSettings(settings: LabelSettings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // A private window, or storage switched off: the settings still apply to this visit.
  }
}
