"use client";

import { Button } from "@dash/ui";
import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import type { StockAdjustmentActionState } from "../inventory.actions";

type ProductOption = {
  id: string;
  sku?: string | null;
  stockQuantity: number;
  title: string;
};

type StockAdjustmentFormProps = {
  action: (state: StockAdjustmentActionState, formData: FormData) => Promise<StockAdjustmentActionState>;
  products: ProductOption[];
};

const initialState: StockAdjustmentActionState = {
  status: "idle"
};

const controlClass =
  "mt-2 h-11 w-full rounded-lg border border-[#e4e3ee] bg-white px-3 text-sm text-[#30313d] outline-none transition placeholder:text-[#9898aa] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10";
const labelClass = "block text-sm font-semibold text-[#20212c]";
const textareaClass =
  "mt-2 w-full rounded-lg border border-[#e4e3ee] bg-white px-3 py-3 text-sm text-[#30313d] outline-none transition placeholder:text-[#9898aa] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10";

export function StockAdjustmentForm({ action, products }: StockAdjustmentFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="resource-form compact-form catalog-create-form space-y-5">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <FieldError errors={state.fieldErrors} name="productId">
          <label className={labelClass}>
            Product
            <select className={controlClass} name="productId" required>
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.title} ({product.stockQuantity} in stock{product.sku ? `, ${product.sku}` : ""})
                </option>
              ))}
            </select>
          </label>
        </FieldError>

        <FieldError errors={state.fieldErrors} name="adjustmentType">
          <label className={labelClass}>
            Adjustment Type
            <select className={controlClass} defaultValue="INCREASE" name="adjustmentType">
              <option value="INCREASE">Increase</option>
              <option value="DECREASE">Decrease</option>
              <option value="SET">Set Exact Quantity</option>
            </select>
          </label>
        </FieldError>

        <FieldError errors={state.fieldErrors} name="quantity">
          <label className={labelClass}>
            Quantity
            <input className={controlClass} min="0" name="quantity" required step="1" type="number" />
          </label>
        </FieldError>

        <FieldError errors={state.fieldErrors} name="reason">
          <label className={labelClass}>
            Reason
            <input className={controlClass} name="reason" placeholder="Cycle count correction" required type="text" />
          </label>
        </FieldError>
      </div>

      <FieldError errors={state.fieldErrors} name="notes">
        <label className={labelClass}>
          Notes
          <textarea className={textareaClass} name="notes" placeholder="Optional internal note" rows={4} />
        </label>
      </FieldError>

      <label className="flex items-center gap-2 rounded-xl border border-[#efedf8] bg-[#fbfaff] px-4 py-3 text-xs font-medium text-[#565762]">
        <input className="h-4 w-4 rounded border-[#cfcde0] text-[#7c3aed]" name="allowNegative" type="checkbox" />
        Allow negative stock for this adjustment
      </label>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#efeff5] pt-5">
        <Link className="secondary link-button" href="/dashboard/inventory">
          Cancel
        </Link>
        <Button className="h-11 rounded-lg bg-[#7c3aed] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-60" disabled={isPending} type="submit">
          {isPending ? "Updating stock..." : "Save adjustment"}
        </Button>
      </div>
    </form>
  );
}

function FieldError({
  children,
  errors,
  name
}: {
  children: ReactNode;
  errors: Record<string, string> | undefined;
  name: string;
}) {
  return (
    <div>
      {children}
      {errors?.[name] ? <p className="form-error">{errors[name]}</p> : null}
    </div>
  );
}
