"use client";

import { useId, type CSSProperties } from "react";
import {
  cleanVariantOptions,
  isVariantPurchasable,
  optionSwatchColour,
  optionValueState,
  variantForOptionValue,
  type PickerVariant,
  type VariantOptionGroup,
  type VariantValueState
} from "../variant-options";

type VariantOptionPickerProps<T extends PickerVariant> = {
  /** From `variantOptionGroups`; null shows one button per variant instead. */
  groups: VariantOptionGroup[] | null;
  onSelect: (variant: T) => void;
  selected: T | undefined;
  variantStyle: "buttons" | "dropdown";
  variants: T[];
};

type PickerValue = {
  key: string;
  label: string;
  onPick: () => void;
  pressed: boolean;
  state: VariantValueState;
  swatch: string | null;
};

/**
 * The option picker the product page and Quick View share.
 *
 * One row per attribute — "Color: Black", then "Size: M" — rather than one
 * button per combination, so six colours in four sizes is ten buttons and not
 * twenty-four, and the shopper's question ("is there an L?") has a row of its
 * own to answer it. Sold-out values are struck through but stay pickable, so a
 * shopper can see that their size exists and is gone rather than wondering
 * whether it was ever made.
 *
 * It only chooses a variant; the caller owns what that changes (price, stock,
 * picture, the buy box).
 */
export function VariantOptionPicker<T extends PickerVariant>({
  groups,
  onSelect,
  selected,
  variantStyle,
  variants
}: VariantOptionPickerProps<T>) {
  const baseId = useId();

  if (!groups) {
    return (
      <div className="sf-variant-picker">
        <OptionRow
          id={`${baseId}-options`}
          label="Options"
          selectedLabel={selected?.title}
          values={variants.map((variant) => ({
            key: variant.optionSignature,
            label: variant.title,
            onPick: () => onSelect(variant),
            pressed: variant.optionSignature === selected?.optionSignature,
            state: isVariantPurchasable(variant) ? "available" : "sold-out",
            swatch: null
          }))}
          variantStyle={variantStyle}
        />
      </div>
    );
  }

  const selection = cleanVariantOptions(selected?.options);

  return (
    <div className="sf-variant-picker">
      {groups.map((group, index) => (
        <OptionRow
          id={`${baseId}-${index}`}
          key={group.name}
          label={group.name}
          selectedLabel={selection[group.name]}
          values={group.values.map((value) => ({
            key: value,
            label: value,
            onPick: () => {
              const next = variantForOptionValue(variants, groups, selected, group.name, value);

              if (next) {
                onSelect(next);
              }
            },
            pressed: selection[group.name] === value,
            state: optionValueState(variants, groups, selected, group.name, value),
            swatch: optionSwatchColour(group.name, value)
          }))}
          variantStyle={variantStyle}
        />
      ))}
    </div>
  );
}

function OptionRow({
  id,
  label,
  selectedLabel,
  values,
  variantStyle
}: {
  id: string;
  label: string;
  selectedLabel: string | undefined;
  values: PickerValue[];
  variantStyle: "buttons" | "dropdown";
}) {
  if (variantStyle === "dropdown") {
    const current = values.find((value) => value.pressed);

    return (
      <div className="sf-variant-group">
        <label className="sf-variant-label" htmlFor={id}>
          <span>{label}</span>
        </label>
        <select
          className="sf-variant-select"
          id={id}
          onChange={(event) => values.find((value) => value.key === event.target.value)?.onPick()}
          value={current?.key ?? ""}
        >
          {current ? null : <option value="">Choose {label.toLowerCase()}</option>}
          {values.map((value) => (
            <option key={value.key} value={value.key}>
              {value.label}
              {value.state === "sold-out"
                ? " — Sold out"
                : value.state === "unavailable"
                  ? " — Not in this combination"
                  : ""}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div aria-labelledby={id} className="sf-variant-group" role="group">
      <p className="sf-variant-label" id={id}>
        <span>{label}:</span>
        {selectedLabel ? <strong>{selectedLabel}</strong> : null}
      </p>
      <div className="sf-variant-values">
        {values.map((value) => (
          <button
            aria-pressed={value.pressed}
            className="sf-variant-value"
            data-state={value.state === "available" ? undefined : value.state}
            key={value.key}
            onClick={value.onPick}
            title={
              value.state === "sold-out"
                ? `${value.label} — sold out`
                : value.state === "unavailable"
                  ? `${value.label} — not available with your other choices`
                  : undefined
            }
            type="button"
          >
            {value.swatch ? (
              <span
                aria-hidden="true"
                className="sf-variant-swatch"
                style={{ "--sf-swatch": value.swatch } as CSSProperties}
              />
            ) : null}
            <span>{value.label}</span>
            {value.state === "sold-out" ? <span className="sr-only">, sold out</span> : null}
            {value.state === "unavailable" ? (
              <span className="sr-only">, not available with your other choices</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
