/**
 * Barcode symbologies, as pure functions from a value to its bars.
 *
 * Two of them, because a shop's labels carry two kinds of number. A code
 * StoreIM assigns, and a manufacturer's code already printed on a box, are
 * EAN-13 when they are thirteen digits with a valid check digit — every retail
 * scanner reads it out of the box, and it is the barcode a shopper recognises.
 * Anything else a seller types — an SKU-style `TS-RED-M`, a twelve-digit UPC,
 * an internal number — is Code 128, which every scanner also reads and which
 * carries any printable ASCII.
 *
 * No library: each symbology is a lookup table and a checksum, and
 * `verify-barcodes` checks both tables against the structural rules their
 * patterns obey and decodes the output with an independent reader, so a
 * mistyped row fails there instead of printing a label no scanner can read.
 *
 * Nothing here knows about millimetres. An encoding is measured in *modules* —
 * the width of the narrowest bar — and the label decides how wide a module is.
 */

export type BarcodeSymbology = "code128" | "ean13";

export type BarcodeBar = {
  /** Guard bars run down into the digit line, as on any EAN-13 in a shop. */
  guard: boolean;
  width: number;
  x: number;
};

export type BarcodeEncoding = {
  bars: BarcodeBar[];
  symbology: BarcodeSymbology;
  /** The human-readable line, each run of characters centred on `x`. */
  text: Array<{ value: string; x: number }>;
  /** Width in modules, quiet zones included. */
  totalModules: number;
  value: string;
};

/**
 * Code 128 symbol widths, values 0–105 then the stop symbol: alternating bar
 * and space widths in modules, starting with a bar. Every symbol is 11 modules
 * wide and the stop is 13.
 */
export const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
  "211214", "211232", "2331112"
] as const;

const CODE128_CODE_C = 99;
const CODE128_CODE_B = 100;
const CODE128_START_B = 104;
const CODE128_START_C = 105;
const CODE128_STOP = 106;
/** Ten modules of clear space each side is the symbology's own minimum. */
const CODE128_QUIET = 10;

/** EAN-13 left-hand odd-parity ("L") digit patterns; R and G are derived. */
export const EAN_L_PATTERNS = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011"
] as const;

/** Which of L and G encodes each left-hand digit, chosen by the first digit. */
export const EAN_PARITY = [
  "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
  "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"
] as const;

/** Eleven modules left (room for the first digit) and seven right. */
const EAN_QUIET_LEFT = 11;
const EAN_QUIET_RIGHT = 7;

/**
 * GS1 reserves prefixes 20–29 for numbers that never leave the shop, so a code
 * StoreIM assigns can never be mistaken for — or collide with — a real
 * manufacturer's barcode on something else on the same shelf.
 */
export const IN_STORE_EAN_PREFIX = "20";

export function isCode128Encodable(value: string) {
  return /^[\x20-\x7E]+$/.test(value);
}

export function ean13CheckDigit(first12: string) {
  if (!/^\d{12}$/.test(first12)) {
    throw new Error("An EAN-13 check digit needs exactly twelve digits.");
  }

  let sum = 0;

  for (let index = 0; index < 12; index += 1) {
    sum += Number(first12[index]) * (index % 2 === 0 ? 1 : 3);
  }

  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(value: string) {
  return /^\d{13}$/.test(value) && ean13CheckDigit(value.slice(0, 12)) === Number(value[12]);
}

/**
 * A fresh in-store EAN-13: the reserved prefix, ten random digits, the check
 * digit. Randomness is the caller's, so the server can use `crypto.randomInt`
 * and the product form `crypto.getRandomValues`, and the check can be fed a
 * fixed sequence.
 */
export function generateInStoreEan13(randomDigit: () => number) {
  let body = IN_STORE_EAN_PREFIX;

  while (body.length < 12) {
    const digit = randomDigit();

    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
      throw new Error("randomDigit must return an integer from 0 to 9.");
    }

    body += String(digit);
  }

  return `${body}${ean13CheckDigit(body)}`;
}

/**
 * The bars for a value: EAN-13 when it is a valid one, Code 128 otherwise.
 * Throws on anything Code 128 cannot carry, which `barcodeValueSchema` already
 * refuses before a value can be stored.
 */
export function encodeBarcode(value: string): BarcodeEncoding {
  return isValidEan13(value) ? encodeEan13(value) : encodeCode128(value);
}

export function encodeEan13(value: string): BarcodeEncoding {
  if (!isValidEan13(value)) {
    throw new Error(`"${value}" is not a valid EAN-13.`);
  }

  const digits = [...value].map(Number);
  const parity = EAN_PARITY[digits[0] ?? 0] ?? EAN_PARITY[0];
  let modules = "101";
  const guards: Array<[number, number]> = [[0, 3]];

  for (let index = 1; index <= 6; index += 1) {
    const digit = digits[index] ?? 0;
    modules += parity[index - 1] === "G" ? eanG(digit) : eanL(digit);
  }

  guards.push([modules.length, modules.length + 5]);
  modules += "01010";

  for (let index = 7; index <= 12; index += 1) {
    modules += eanR(digits[index] ?? 0);
  }

  guards.push([modules.length, modules.length + 3]);
  modules += "101";

  const text = [{ value: value.slice(0, 1), x: EAN_QUIET_LEFT - 5 }];

  for (let index = 1; index <= 12; index += 1) {
    // Each digit sits under its own seven modules, the right half after the
    // five-module centre guard.
    const start = index <= 6 ? 3 + (index - 1) * 7 : 50 + (index - 7) * 7;
    text.push({ value: value.slice(index, index + 1), x: EAN_QUIET_LEFT + start + 3.5 });
  }

  return {
    bars: barsFromModules(modules, EAN_QUIET_LEFT, guards),
    symbology: "ean13",
    text,
    totalModules: EAN_QUIET_LEFT + modules.length + EAN_QUIET_RIGHT,
    value
  };
}

export function encodeCode128(value: string): BarcodeEncoding {
  const symbols = code128Symbols(value);
  const modules = symbols
    .map((symbol) => widthsToModules(CODE128_PATTERNS[symbol] ?? ""))
    .join("");

  return {
    bars: barsFromModules(modules, CODE128_QUIET, []),
    symbology: "code128",
    text: [{ value, x: CODE128_QUIET + modules.length / 2 }],
    totalModules: CODE128_QUIET * 2 + modules.length,
    value
  };
}

/**
 * Symbol values for a value, start to stop, check symbol included.
 *
 * Subsets B and C only: B carries every printable ASCII character, and C packs
 * two digits into one symbol. A run of digits switches to C only where that
 * saves width — four at either end, six in the middle (where switching back
 * costs a second symbol) — and an odd run spends its first digit in B so C only
 * ever sees whole pairs. Subset A exists for control characters, which a
 * barcode a person typed never contains.
 */
export function code128Symbols(value: string) {
  if (!value || !isCode128Encodable(value)) {
    throw new Error("Code 128 here carries printable ASCII only.");
  }

  const symbols: number[] = [];
  const leading = digitRun(value, 0);
  let mode: "B" | "C";
  let index = 0;

  if (leading >= 4 || (leading === value.length && leading % 2 === 0)) {
    mode = "C";
    symbols.push(CODE128_START_C);
  } else {
    mode = "B";
    symbols.push(CODE128_START_B);
  }

  while (index < value.length) {
    if (mode === "C") {
      if (digitRun(value, index) >= 2) {
        symbols.push(Number(value.slice(index, index + 2)));
        index += 2;
      } else {
        symbols.push(CODE128_CODE_B);
        mode = "B";
      }

      continue;
    }

    const run = digitRun(value, index);
    const reachesEnd = index + run === value.length;

    if (run >= 6 || (reachesEnd && run >= 4)) {
      if (run % 2 === 1) {
        symbols.push(value.charCodeAt(index) - 32);
        index += 1;
      }

      symbols.push(CODE128_CODE_C);
      mode = "C";
      continue;
    }

    symbols.push(value.charCodeAt(index) - 32);
    index += 1;
  }

  let checksum = symbols[0] ?? 0;

  for (let position = 1; position < symbols.length; position += 1) {
    checksum += position * (symbols[position] ?? 0);
  }

  symbols.push(checksum % 103, CODE128_STOP);

  return symbols;
}

function digitRun(value: string, from: number) {
  let length = 0;

  while (from + length < value.length && isDigit(value.charCodeAt(from + length))) {
    length += 1;
  }

  return length;
}

function isDigit(code: number) {
  return code >= 48 && code <= 57;
}

function widthsToModules(widths: string) {
  let modules = "";

  for (let index = 0; index < widths.length; index += 1) {
    modules += (index % 2 === 0 ? "1" : "0").repeat(Number(widths[index]));
  }

  return modules;
}

function eanL(digit: number) {
  return EAN_L_PATTERNS[digit] ?? EAN_L_PATTERNS[0];
}

/** R is L with every module inverted. */
function eanR(digit: number) {
  return [...eanL(digit)].map((module) => (module === "1" ? "0" : "1")).join("");
}

/** G is R read backwards. */
function eanG(digit: number) {
  return [...eanR(digit)].reverse().join("");
}

/** Runs of `1` become bars; a bar is a guard when it starts inside a guard pattern. */
function barsFromModules(modules: string, offset: number, guards: Array<[number, number]>) {
  const bars: BarcodeBar[] = [];
  let index = 0;

  while (index < modules.length) {
    if (modules[index] !== "1") {
      index += 1;
      continue;
    }

    let end = index;

    while (modules[end] === "1") {
      end += 1;
    }

    bars.push({
      guard: guards.some(([from, to]) => index >= from && index < to),
      width: end - index,
      x: offset + index
    });
    index = end;
  }

  return bars;
}
