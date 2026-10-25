/**
 * The option picker on the product page and in Quick View, as pure functions.
 *
 * A variant is stored as one combination — "Black / M" — but a shopper does not
 * think in combinations: they pick a colour, then a size. These turn the first
 * into the second, so the picker can show one row per attribute and still hand
 * the buy box exactly one variant id.
 *
 * Nothing here decides what is for sale. The variants handed in are already the
 * active ones (an inactive option is dropped before it reaches the browser), and
 * "sold out" is the same rule the stepper caps by: no stock and not set to keep
 * selling. The cart re-checks both when the line is written.
 */

export type PickerVariant = {
  continueSelling?: boolean | undefined;
  imageUrl?: string | null | undefined;
  optionSignature: string;
  options?: Record<string, string> | null | undefined;
  stockQuantity: number;
  title: string;
};

export type VariantOptionGroup = {
  name: string;
  values: string[];
};

/**
 * How one value reads given what else is picked: `unavailable` means no variant
 * pairs it with the shopper's other choices, so picking it moves those too.
 */
export type VariantValueState = "available" | "sold-out" | "unavailable";

export function isVariantPurchasable(
  variant: Pick<PickerVariant, "continueSelling" | "stockQuantity">
) {
  return Boolean(variant.continueSelling) || variant.stockQuantity > 0;
}

/**
 * The option a page opens on: the first one a shopper can actually buy, so the
 * buy button is not greyed out on arrival because the seller's first
 * combination happens to have sold out.
 */
export function initialPickerVariant<T extends PickerVariant>(variants: T[]): T | undefined {
  return variants.find(isVariantPurchasable) ?? variants[0];
}

/** Names trimmed, blanks dropped: the shape every comparison below uses. */
export function cleanVariantOptions(options: PickerVariant["options"]) {
  const clean: Record<string, string> = {};

  for (const [name, value] of Object.entries(options ?? {})) {
    const key = name.trim();
    const text = typeof value === "string" ? value.trim() : "";

    if (key && text) {
      clean[key] = text;
    }
  }

  return clean;
}

/**
 * One group per attribute, in the seller's order, or null when the variants
 * cannot be described that way.
 *
 * Null sends the picker back to one button per variant, which is always right.
 * That happens when a variant has no options at all, when two variants name
 * different attributes, or when two share one combination — the editor's
 * Duplicate button makes exactly that, and only the flat list can tell them
 * apart.
 *
 * The attribute order comes from the title ("Black / M" → colour, then size),
 * not from the options object: options come back from a `jsonb` column, which
 * sorts its keys shortest-first, so "Size" would otherwise lead.
 */
export function variantOptionGroups(variants: PickerVariant[]): VariantOptionGroup[] | null {
  const first = variants[0];

  if (!first) {
    return null;
  }

  const names = orderedOptionNames(first);

  if (names.length === 0) {
    return null;
  }

  const combinations = new Set<string>();

  for (const variant of variants) {
    const options = cleanVariantOptions(variant.options);

    if (
      Object.keys(options).length !== names.length ||
      names.some((name) => options[name] === undefined)
    ) {
      return null;
    }

    const combination = names.map((name) => options[name]).join("\u0000");

    if (combinations.has(combination)) {
      return null;
    }

    combinations.add(combination);
  }

  // Values in the order the variants list them, which is the order the seller
  // generated them in: Red before Blue if Red was typed first.
  return names.map((name) => {
    const values: string[] = [];

    for (const variant of variants) {
      const value = cleanVariantOptions(variant.options)[name];

      if (value !== undefined && !values.includes(value)) {
        values.push(value);
      }
    }

    return { name, values };
  });
}

/**
 * The variant a click on one value should select.
 *
 * Keeping the shopper's other choices matters most — tapping Red while on Size
 * L should land on Red / L, even if that one is sold out, because the shopper
 * asked about L. Only when no variant keeps them does it move them, and then it
 * prefers one that can be bought.
 */
export function variantForOptionValue<T extends PickerVariant>(
  variants: T[],
  groups: VariantOptionGroup[],
  current: PickerVariant | undefined,
  name: string,
  value: string
): T | undefined {
  const selection = cleanVariantOptions(current?.options);
  let best: T | undefined;
  let bestScore = -1;

  for (const variant of variants) {
    const options = cleanVariantOptions(variant.options);

    if (options[name] !== value) {
      continue;
    }

    const kept = groups.filter(
      (group) => group.name !== name && options[group.name] === selection[group.name]
    ).length;
    const score = kept * 2 + (isVariantPurchasable(variant) ? 1 : 0);

    if (score > bestScore) {
      best = variant;
      bestScore = score;
    }
  }

  return best;
}

export function optionValueState(
  variants: PickerVariant[],
  groups: VariantOptionGroup[],
  current: PickerVariant | undefined,
  name: string,
  value: string
): VariantValueState {
  const selection = cleanVariantOptions(current?.options);
  const match = variants.find((variant) => {
    const options = cleanVariantOptions(variant.options);

    return (
      options[name] === value &&
      groups.every((group) => group.name === name || options[group.name] === selection[group.name])
    );
  });

  if (!match) {
    return "unavailable";
  }

  return isVariantPurchasable(match) ? "available" : "sold-out";
}

/**
 * The picture to show for a variant: its own, or one from a variant of the same
 * colour.
 *
 * Sellers usually photograph a colour once, on whichever size they generated
 * first, so picking Red / L would otherwise leave Black on screen. Only a
 * colour is borrowed across: a size sharing a picture with another colour is
 * the wrong garment.
 */
export function pickerVariantImage(
  variants: PickerVariant[],
  groups: VariantOptionGroup[] | null,
  variant: PickerVariant | undefined
) {
  if (!variant) {
    return "";
  }

  if (variant.imageUrl) {
    return variant.imageUrl;
  }

  const options = cleanVariantOptions(variant.options);

  for (const group of groups ?? []) {
    if (!isColourAttribute(group.name)) {
      continue;
    }

    const sibling = variants.find(
      (item) =>
        item.imageUrl && cleanVariantOptions(item.options)[group.name] === options[group.name]
    );

    if (sibling?.imageUrl) {
      return sibling.imageUrl;
    }
  }

  return "";
}

export function isColourAttribute(name: string) {
  return /colou?r|shade|রং|রঙ/i.test(name);
}

/**
 * A dot of colour for a value that names one, or null.
 *
 * Only for an attribute that is a colour, and only for names on this list or a
 * hex code: a dot that guessed would show a shopper a colour the product is not.
 * Bangla names are here because sellers type them.
 */
export function optionSwatchColour(attributeName: string, value: string) {
  if (!isColourAttribute(attributeName)) {
    return null;
  }

  const text = value.trim().toLowerCase();

  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(text)) {
    return text;
  }

  return SWATCH_COLOURS[text] ?? null;
}

function orderedOptionNames(variant: PickerVariant) {
  const options = cleanVariantOptions(variant.options);
  const order = variant.title.split("/").map((segment) => segment.trim());
  const rank = (value: string) => {
    const position = order.indexOf(value);

    return position < 0 ? order.length : position;
  };

  return Object.entries(options)
    .sort((left, right) => rank(left[1]) - rank(right[1]))
    .map(([name]) => name);
}

const SWATCH_COLOURS: Record<string, string> = {
  ash: "#b2b4b6",
  beige: "#d9c7a7",
  black: "#111111",
  blue: "#1e63d6",
  "bottle green": "#0b5d3b",
  brown: "#7b4a2a",
  burgundy: "#7c1f32",
  camel: "#c19a6b",
  charcoal: "#36393d",
  chocolate: "#5a3220",
  coral: "#f2795f",
  cream: "#f3ead3",
  denim: "#3d5a80",
  gold: "#c9a43b",
  golden: "#c9a43b",
  gray: "#8e8e93",
  green: "#2e7d32",
  grey: "#8e8e93",
  "hot pink": "#e91e8c",
  ivory: "#fffff0",
  khaki: "#b5a36a",
  lavender: "#b8a2e3",
  "light blue": "#9ecbf0",
  lime: "#9ccc3c",
  magenta: "#c2185b",
  maroon: "#7a1f2b",
  mint: "#a8e6cf",
  mustard: "#d4a017",
  navy: "#1f2a5a",
  "navy blue": "#1f2a5a",
  "off white": "#f8f5ee",
  olive: "#6b7a2b",
  orange: "#f57c00",
  peach: "#f7b79a",
  pink: "#f48fb1",
  purple: "#7b3fb5",
  red: "#d32f2f",
  rose: "#e57f94",
  "royal blue": "#2747c4",
  "sea green": "#2e8b57",
  silver: "#c0c0c0",
  "sky blue": "#7cc4f0",
  tan: "#c8a27a",
  teal: "#00897b",
  violet: "#7f3fbf",
  white: "#ffffff",
  wine: "#6d1a36",
  yellow: "#f6d32d",
  আকাশি: "#7cc4f0",
  কমলা: "#f57c00",
  কালো: "#111111",
  খয়েরি: "#7b4a2a",
  গোলাপি: "#f48fb1",
  ধূসর: "#8e8e93",
  নীল: "#1e63d6",
  বেগুনি: "#7b3fb5",
  মেরুন: "#7a1f2b",
  লাল: "#d32f2f",
  সবুজ: "#2e7d32",
  সাদা: "#ffffff",
  হলুদ: "#f6d32d"
};
