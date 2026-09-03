import Link from "next/link";
import type { GuestAccountView, GuestOrderView } from "../guest-orders.render";

type GuestOrderHistoryProps = {
  basePath: string;
  storeSlug: string;
  view: GuestAccountView;
};

/**
 * The account page, for a shopper who bought something without making an
 * account.
 *
 * Server-rendered from the view the service built, which is itself re-read from
 * the database on every request — so a seller who confirms an order at noon has
 * changed what the buyer reads at ten past, with nothing to invalidate and no
 * snapshot to go stale.
 */
export function GuestOrderHistory({ basePath, storeSlug, view }: GuestOrderHistoryProps) {
  return (
    <>
      <section className="sf-section sf-account-orders" aria-labelledby="account-orders-title">
        <header className="sf-account-orders-head">
          <div>
            <h2 id="account-orders-title">Your recent orders</h2>
            <p>
              Saved on this device for {view.windowDays} days after each order, so you can follow it
              without signing up.
            </p>
          </div>
          {/*
            The shopper's own way out, and the reason it is a plain form: cash on
            delivery is bought on shared handsets, and clearing a receipt must not
            depend on client JavaScript having loaded.
          */}
          <form action="/api/storefront/guest-orders" className="sf-account-forget" method="post">
            <input name="storeSlug" type="hidden" value={storeSlug} />
            <button type="submit">Not your device? Clear these details</button>
          </form>
        </header>
        <div className="sf-account-order-list">
          {view.orders.map((order) => (
            <GuestOrderCard basePath={basePath} key={order.id} order={order} />
          ))}
        </div>
      </section>
      <section className="sf-section sf-account-grid" aria-label="Your saved checkout details">
        <article className="sf-account-card">
          <h2>Your details</h2>
          <p>What you entered at checkout on this device.</p>
          <ul className="sf-account-facts">
            <li>{view.profile.name}</li>
            <li>{view.profile.phone}</li>
            {view.profile.email ? <li>{view.profile.email}</li> : null}
          </ul>
        </article>
        <article className="sf-account-card">
          <h2>Delivery address</h2>
          <p>Where your most recent order is going.</p>
          {view.address.length > 0 ? (
            <ul className="sf-account-facts">
              {view.address.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p>No delivery address was saved with this order.</p>
          )}
        </article>
        <article className="sf-account-card">
          <h2>Need help?</h2>
          <p>
            Quote your order number when you contact the shop — it is the fastest way to be found.
          </p>
          <ul className="sf-account-facts">
            <li>Orders here clear automatically after {view.windowDays} days.</li>
            <li>Nothing is stored in your browser except the order number.</li>
          </ul>
        </article>
      </section>
    </>
  );
}

function GuestOrderCard({ basePath, order }: { basePath: string; order: GuestOrderView }) {
  return (
    <article className="sf-account-order">
      <header className="sf-account-order-head">
        <div>
          <span>Order</span>
          <strong>{order.orderNumber}</strong>
          {order.placedAtLabel ? <span>Placed {order.placedAtLabel}</span> : null}
        </div>
        <div className="sf-account-chips">
          <span className="sf-account-chip" data-tone="status">
            {order.statusLabel}
          </span>
          <span className="sf-account-chip">{order.paymentStatusLabel}</span>
          <span className="sf-account-chip">{order.fulfillmentLabel}</span>
        </div>
      </header>
      <ul className="sf-account-lines">
        {order.lines.map((line) => (
          <li key={line.id}>
            {line.imageUrl ? (
              <img alt="" loading="lazy" src={line.imageUrl} />
            ) : (
              <span aria-hidden="true" className="sf-account-thumb" />
            )}
            <div>
              <strong>{line.title}</strong>
              <span>
                Qty {line.quantity}
                {line.isPreorder ? " · Pre-order" : ""}
              </span>
            </div>
            <strong>{line.total}</strong>
          </li>
        ))}
      </ul>
      <dl className="sf-account-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{order.subtotal}</dd>
        </div>
        {order.discount ? (
          <div>
            <dt>Discount</dt>
            <dd>-{order.discount}</dd>
          </div>
        ) : null}
        <div>
          <dt>{order.shippingLabel}</dt>
          <dd>{order.shipping}</dd>
        </div>
        {order.tax ? (
          <div>
            <dt>Tax</dt>
            <dd>{order.tax}</dd>
          </div>
        ) : null}
        <div data-total="true">
          <dt>Total</dt>
          <dd>{order.total}</dd>
        </div>
      </dl>
      <footer className="sf-account-order-foot">
        <div>
          <span>Paid by {order.paymentLabel}</span>
          <span>{order.expiryLabel}</span>
        </div>
        <Link className="sf-button" href={`${basePath}/thank-you/${order.orderNumber}`}>
          View order details
        </Link>
      </footer>
    </article>
  );
}
