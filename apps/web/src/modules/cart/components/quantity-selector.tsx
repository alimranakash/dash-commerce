"use client";

type QuantitySelectorProps = {
  disabled?: boolean;
  onChange: (quantity: number) => void;
  quantity: number;
};

export function QuantitySelector({ disabled = false, onChange, quantity }: QuantitySelectorProps) {
  return (
    <div className="general-cart-quantity" aria-label="Quantity selector">
      <button
        aria-label="Decrease quantity"
        disabled={disabled || quantity <= 1}
        onClick={() => onChange(Math.max(1, quantity - 1))}
        type="button"
      >
        -
      </button>
      <span>{quantity}</span>
      <button
        aria-label="Increase quantity"
        disabled={disabled}
        onClick={() => onChange(quantity + 1)}
        type="button"
      >
        +
      </button>
    </div>
  );
}
