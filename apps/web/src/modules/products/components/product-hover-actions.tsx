import Link from "next/link";
import { DeleteConfirmationButton } from "../../../components/dashboard/delete-confirmation-button";
import {
  archiveProductFormAction,
  deleteProductPermanentlyFormAction,
  restoreProductFormAction
} from "../product.actions";
import type { ProductListItem } from "./product-list.types";

type ProductHoverActionsProps = { product: ProductListItem; storeSlug: string };

export function ProductHoverActions({ product, storeSlug }: ProductHoverActionsProps) {
  const isArchived = product.status === "ARCHIVED";

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-[#62636d] opacity-100 transition md:pointer-events-none md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:opacity-100">
      {!isArchived ? (
        <>
          <Link className="hover:text-[#6d3cf5]" href={`/dashboard/products/${product.id}/edit`}>Edit</Link><span>|</span>
          <Link className="hover:text-[#6d3cf5]" href={`/dashboard/products/${product.id}/edit`}>Builder</Link><span>|</span>
          <Link className="hover:text-[#6d3cf5]" href={`/s/${storeSlug}/products/${product.slug}`} target="_blank">View</Link>
          <span>|</span>
          <DeleteConfirmationButton action={archiveProductFormAction.bind(null, product.id)} ariaLabel={`Delete ${product.title}`} className="text-rose-500 hover:text-rose-700" title="Move to trash">Delete</DeleteConfirmationButton>
        </>
      ) : (
        <>
          <form action={restoreProductFormAction.bind(null, product.id)}>
            <button className="text-[#6d3cf5] hover:text-[#4f25c8]" type="submit">Restore</button>
          </form>
          <span>|</span>
          <DeleteConfirmationButton action={deleteProductPermanentlyFormAction.bind(null, product.id)} ariaLabel={`Permanently delete ${product.title}`} className="text-rose-600 hover:text-rose-800" title="Delete permanently">Delete Permanently</DeleteConfirmationButton>
        </>
      )}
    </div>
  );
}
