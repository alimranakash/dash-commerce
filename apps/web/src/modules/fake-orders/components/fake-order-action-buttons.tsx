import {
  blockCustomerAndRedirectAction,
  blockCustomerAction,
  markOrderFakeAction,
  markOrderFakeAndRedirectAction,
  markOrderVerifiedAction,
  markOrderVerifiedAndRedirectAction,
  returnToNormalQueueAction,
  returnToNormalQueueAndRedirectAction
} from "../fake-order.actions";

type FakeOrderActionButtonsProps = {
  compact?: boolean;
  orderId: string;
  redirectToQueue?: boolean;
};

export function FakeOrderActionButtons({ compact = false, orderId, redirectToQueue = false }: FakeOrderActionButtonsProps) {
  const verifiedAction = redirectToQueue ? markOrderVerifiedAndRedirectAction : markOrderVerifiedAction;
  const fakeAction = redirectToQueue ? markOrderFakeAndRedirectAction : markOrderFakeAction;
  const blockAction = redirectToQueue ? blockCustomerAndRedirectAction : blockCustomerAction;
  const normalAction = redirectToQueue ? returnToNormalQueueAndRedirectAction : returnToNormalQueueAction;

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "justify-end" : ""}`}>
      <ActionForm action={verifiedAction.bind(null, orderId)} label="Mark Verified" tone="green" />
      <ActionForm action={fakeAction.bind(null, orderId)} label="Mark Fake" tone="red" />
      <ActionForm action={blockAction.bind(null, orderId)} label="Block Customer" tone="red" />
      <ActionForm action={normalAction.bind(null, orderId)} label="Return to Normal Queue" tone="purple" />
    </div>
  );
}

function ActionForm({ action, label, tone }: { action: () => Promise<void>; label: string; tone: "green" | "purple" | "red" }) {
  const toneClass = {
    green: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
    purple: "border-[#ddd6fe] text-[#6d3cf5] hover:bg-[#f3f0ff]",
    red: "border-red-200 text-red-700 hover:bg-red-50"
  }[tone];

  return (
    <form action={action}>
      <button className={`h-8 rounded-lg border px-3 text-[11px] font-semibold transition ${toneClass}`} type="submit">
        {label}
      </button>
    </form>
  );
}
