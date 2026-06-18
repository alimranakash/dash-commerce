type CheckoutFormProps = {
  checkoutError: string | undefined;
  storeSlug: string;
};

export function CheckoutForm({ checkoutError, storeSlug }: CheckoutFormProps) {
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
        <label className="sf-radio-row">
          <input defaultChecked name="paymentMethod" type="radio" value="COD" />
          Cash on delivery
        </label>
        <label className="sf-form-wide">
          Notes <span>Optional</span>
          <textarea name="notes" rows={3} />
        </label>
      </fieldset>
      <button type="submit">Place order</button>
    </form>
  );
}
