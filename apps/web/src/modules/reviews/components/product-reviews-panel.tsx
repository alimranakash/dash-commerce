import { MessageSquareWarning, Search, Star } from "lucide-react";

export type ProductReviewListItem = {
  actions?: string;
  customer: string;
  date: string;
  id: string;
  product: string;
  rating: number;
  review: string;
  status: string;
};

export function ProductReviewsPanel({ reviews = [], search = "" }: { reviews?: ProductReviewListItem[]; search?: string }) {
  return (
    <section className="flex min-h-[540px] flex-col rounded-xl border border-[#ececf5] bg-white px-6 py-6 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <form className="ml-auto flex w-full gap-3 sm:w-auto" method="get">
        <input
          aria-label="Search product reviews"
          className="h-11 min-w-0 flex-1 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] sm:w-80"
          defaultValue={search}
          name="search"
          placeholder="Search by customer name or product name"
          type="search"
        />
        <button aria-label="Search reviews" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#7548f5] text-white transition hover:bg-[#6436e8]" type="submit">
          <Search aria-hidden="true" className="h-4 w-4" />
        </button>
      </form>

      {reviews.length ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead className="bg-[#f7f7fa] text-[#5f616d]"><tr><th className="p-3">Product</th><th className="p-3">Customer</th><th className="p-3">Rating</th><th className="p-3">Review</th><th className="p-3">Status</th><th className="p-3">Date</th><th className="p-3">Actions</th></tr></thead>
            <tbody>
              {reviews.map((review) => (
                <tr className="border-b border-[#efeff5]" key={review.id}>
                  <td className="p-3 font-medium">{review.product}</td>
                  <td className="p-3">{review.customer}</td>
                  <td className="p-3"><span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{review.rating}</span></td>
                  <td className="max-w-xs truncate p-3">{review.review}</td>
                  <td className="p-3">{review.status}</td>
                  <td className="p-3">{review.date}</td>
                  <td className="p-3">{review.actions ?? "View"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <div className="mb-5 grid h-28 w-28 place-items-center rounded-2xl bg-[#f4f1ff] text-[#7650e8]">
            <MessageSquareWarning aria-hidden="true" className="h-20 w-20" strokeWidth={1.35} />
          </div>
          <h2 className="m-0 text-xl font-semibold text-[#20212a]">No Reviews Yet</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#85869a]">All customer reviews and feedback will appear here once they&apos;re submitted.</p>
        </div>
      )}
    </section>
  );
}
