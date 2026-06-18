import type { PaymentMethodTypeValue } from "../../payments/payment.schema";

type CheckoutPaymentMethod = {
  type: PaymentMethodTypeValue;
  name: string;
  description: string | null;
  instructions: string | null;
  accountNumber: string | null;
  accountType: string | null;
};

type CheckoutFormProps = {
  checkoutError: string | undefined;
  paymentMethods: CheckoutPaymentMethod[];
  storeSlug: string;
};

export function CheckoutForm({ checkoutError, paymentMethods, storeSlug }: CheckoutFormProps) {
  const defaultMethod = paymentMethods.find((method) => method.type === "COD") ?? paymentMethods[0];

  return (
    <form action="/api/checkout" className="sf-checkout-form" method="post">
      <input name="storeSlug" type="hidden" value={storeSlug} />
      {checkoutError ? <p className="sf-alert">{checkoutError}</p> : null}
      <fieldset>
        <legend>Contact</legend>
        <label>
          Name
          <input autoComplete="name" name="name" required type="text" />
        </label>
        <label>
          Phone
          <input autoComplete="tel" name="phone" required type="tel" />
        </label>
        <label>
          Email <span>Optional</span>
          <input autoComplete="email" name="email" type="email" />
        </label>
      </fieldset>
      <fieldset>
        <legend>Delivery address</legend>
        <label>
          Country
          <input autoComplete="country-name" defaultValue="Bangladesh" name="country" required />
        </label>
        <label>
          District
          <input autoComplete="address-level1" name="district" required type="text" />
        </label>
        <label>
          City <span>Optional</span>
          <input autoComplete="address-level2" name="city" type="text" />
        </label>
        <label>
          Area <span>Optional</span>
          <input name="area" type="text" />
        </label>
        <label className="sf-form-wide">
          Full address
          <textarea autoComplete="street-address" name="addressLine1" required rows={4} />
        </label>
        <label className="sf-form-wide">
          Address line 2 <span>Optional</span>
          <input name="addressLine2" type="text" />
        </label>
        <label>
          Postal code <span>Optional</span>
          <input autoComplete="postal-code" name="postalCode" type="text" />
        </label>
      </fieldset>
      <fieldset>
        <legend>Payment</legend>
        {paymentMethods.length === 0 ? (
          <p className="sf-alert">This store has not enabled any payment methods yet.</p>
        ) : (
          paymentMethods.map((method) => (
            <label className="sf-radio-row payment-option" key={method.type}>
              <input
                defaultChecked={method.type === defaultMethod?.type}
                name="paymentMethod"
                required
                type="radio"
                value={method.type}
              />
              <span>
                <strong>{method.name}</strong>
                {method.description ? <small>{method.description}</small> : null}
                {method.accountNumber ? (
                  <small>
                    {method.accountType ? `${method.accountType}: ` : ""}
                    {method.accountNumber}
                  </small>
                ) : null}
                {method.instructions ? <small>{method.instructions}</small> : null}
              </span>
            </label>
          ))
        )}
        <label>
          Transaction ID / reference
          <input
            name="paymentReference"
            placeholder="Required for bKash, Nagad, or Rocket"
            type="text"
          />
        </label>
        <label className="sf-form-wide">
          Payment note <span>Optional</span>
          <textarea name="paymentNote" rows={3} />
        </label>
        <label className="sf-form-wide">
          Order notes <span>Optional</span>
          <textarea name="notes" rows={3} />
        </label>
      </fieldset>
      <button disabled={paymentMethods.length === 0} type="submit">
        Place order
      </button>
    </form>
  );
}
