import {
  PRODUCT_CONTENT_LIMITS,
  type ProductContentField,
  type ProductContentLanguage,
  type ProductContentTone,
  type ProductContentValues
} from "./product-content.schema";

/**
 * Everything the composer is allowed to know, which is exactly what the store's
 * own product row already says. Same shape the StoreOS request is built from,
 * so the two paths cannot disagree about what a product is.
 */
export type ProductContentSubject = {
  brand: string | null;
  categoryName: string | null;
  currency: string;
  description: string | null;
  features: string | null;
  keywords: string | null;
  price: string;
  /** Null while the product is still a form nobody has saved. */
  productId: string | null;
  shortDescription: string | null;
  sku: string | null;
  storeName: string;
  tags: string[];
  title: string;
};

type Phrases = {
  benefit: (subject: ProductContentSubject) => string;
  callToAction: string;
  descriptionOpening: (subject: ProductContentSubject) => string;
  fallbackFeatures: (subject: ProductContentSubject) => string[];
  metaOpening: (subject: ProductContentSubject) => string;
  shortDescription: (subject: ProductContentSubject) => string;
  socialOpening: (subject: ProductContentSubject) => string;
  trustLine: string;
};

/**
 * The offline composer.
 *
 * It is not a language model and does not pretend to be one: it arranges facts
 * that are already on the product row into sentences, in the seller's chosen
 * language and register. Every draft it returns is labelled `template` by the
 * service so the editor can say plainly where the words came from.
 *
 * It exists because "StoreIM AI is not connected" should not leave the studio with
 * nothing to show. A seller on a store whose platform link is not provisioned
 * still gets a first draft to edit, and the moment StoreOS is reachable the
 * same button returns real generated copy instead.
 */
export function composeProductContent(params: {
  fields: readonly ProductContentField[];
  language: ProductContentLanguage;
  subject: ProductContentSubject;
  tone: ProductContentTone;
}): ProductContentValues {
  const { fields, language, subject, tone } = params;
  const phrases = PHRASES[language][tone];
  const values: ProductContentValues = {};

  for (const field of fields) {
    const value = composeField({ field, phrases, subject });

    if (value) {
      values[field] = clamp(value, PRODUCT_CONTENT_LIMITS[field]);
    }
  }

  return values;
}

function composeField(params: {
  field: ProductContentField;
  phrases: Phrases;
  subject: ProductContentSubject;
}) {
  const { field, phrases, subject } = params;

  switch (field) {
    case "title":
      return composeTitle(subject);
    case "shortDescription":
      return phrases.shortDescription(subject);
    case "description":
      return composeDescription(phrases, subject);
    case "features":
      return composeFeatures(phrases, subject).join("\n");
    case "seoTitle":
      return composeSeoTitle(subject);
    case "metaDescription":
      return `${phrases.metaOpening(subject)} ${phrases.callToAction}`;
    case "keywords":
      return composeKeywords(subject).join(", ");
    case "socialCaption":
      return composeSocialCaption(phrases, subject);
  }
}

/**
 * The title is the one field with nothing to derive from but itself, so the
 * composer refines rather than invents: it appends the brand or category only
 * when the existing title does not already carry it.
 */
function composeTitle(subject: ProductContentSubject) {
  const qualifier = subject.brand ?? subject.categoryName;

  if (!qualifier || includesWord(subject.title, qualifier)) {
    return subject.title;
  }

  return `${qualifier} ${subject.title}`;
}

function composeSeoTitle(subject: ProductContentSubject) {
  const parts = [subject.title, subject.brand ?? subject.categoryName, subject.storeName].filter(
    (part): part is string => Boolean(part)
  );
  const seen: string[] = [];

  for (const part of parts) {
    if (!seen.some((existing) => includesWord(existing, part))) {
      seen.push(part);
    }
  }

  return seen.join(" | ");
}

function composeDescription(phrases: Phrases, subject: ProductContentSubject) {
  const paragraphs = [phrases.descriptionOpening(subject), phrases.benefit(subject)];
  const features = composeFeatures(phrases, subject);

  if (features.length) {
    paragraphs.push(features.map((feature) => `• ${feature}`).join("\n"));
  }

  paragraphs.push(phrases.trustLine);

  return paragraphs.join("\n\n");
}

/**
 * The seller's own highlights win when they exist. Only a product with none
 * falls back to the generated lines, so re-running the studio never overwrites
 * hand-written bullets with weaker ones.
 */
function composeFeatures(phrases: Phrases, subject: ProductContentSubject) {
  const existing = splitLines(subject.features);

  if (existing.length) {
    return existing.slice(0, 6);
  }

  return phrases.fallbackFeatures(subject).slice(0, 6);
}

function composeKeywords(subject: ProductContentSubject) {
  const candidates = [
    subject.title,
    subject.brand,
    subject.categoryName,
    ...subject.tags,
    ...splitList(subject.keywords),
    subject.storeName
  ];
  const keywords: string[] = [];

  for (const candidate of candidates) {
    const value = candidate?.trim().toLowerCase();

    if (value && !keywords.includes(value)) {
      keywords.push(value);
    }
  }

  return keywords.slice(0, 12);
}

function composeSocialCaption(phrases: Phrases, subject: ProductContentSubject) {
  const hashtags = composeKeywords(subject)
    .slice(0, 4)
    .map((keyword) => `#${keyword.replace(/[^\p{L}\p{N}]+/gu, "")}`)
    .filter((hashtag) => hashtag.length > 1);

  return [phrases.socialOpening(subject), phrases.callToAction, hashtags.join(" ")]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Price as the caption and description quote it. The currency code rather than a
 * symbol, because `store.currency` is a code and BDT has no symbol every font
 * renders.
 */
function priceLabel(subject: ProductContentSubject) {
  return `${subject.currency} ${subject.price}`;
}

function subjectNoun(subject: ProductContentSubject) {
  return subject.categoryName ?? subject.title;
}

/**
 * Register, per language.
 *
 * Three tones rather than a free-text style prompt: the composer can only vary
 * what it has sentences for, and offering a box that quietly does nothing would
 * be worse than offering three choices that visibly do something. StoreOS gets
 * the same tone value and is free to do more with it.
 */
const PHRASES: Record<ProductContentLanguage, Record<ProductContentTone, Phrases>> = {
  bn: {
    friendly: {
      benefit: (subject) =>
        `প্রতিদিনের ব্যবহারের জন্য ${subjectNoun(subject)} হিসেবে এটি সহজ এবং নির্ভরযোগ্য পছন্দ।`,
      callToAction: "আজই অর্ডার করুন।",
      descriptionOpening: (subject) =>
        `${subject.title} এখন ${subject.storeName}-এ পাওয়া যাচ্ছে, মাত্র ${priceLabel(subject)}।`,
      fallbackFeatures: (subject) => [
        `${subjectNoun(subject)} হিসেবে বাছাই করা মান`,
        `দাম ${priceLabel(subject)}`,
        "সারা দেশে ডেলিভারি",
        "ক্যাশ অন ডেলিভারি সুবিধা"
      ],
      metaOpening: (subject) =>
        `${subject.title} কিনুন ${priceLabel(subject)} দামে ${subject.storeName} থেকে।`,
      shortDescription: (subject) =>
        `${subject.title} — ${priceLabel(subject)}, ${subject.storeName} থেকে দ্রুত ডেলিভারি।`,
      socialOpening: (subject) =>
        `🎉 নতুন এসেছে ${subject.title}! দাম মাত্র ${priceLabel(subject)}।`,
      trustLine: "যেকোনো প্রশ্নে আমাদের ইনবক্স করুন — আমরা উত্তর দিতে প্রস্তুত।"
    },
    premium: {
      benefit: (subject) => `যাঁরা ${subjectNoun(subject)}-এ আপস করেন না, এটি তাঁদের জন্যই তৈরি।`,
      callToAction: "সীমিত সংগ্রহ — আজই সংগ্রহ করুন।",
      descriptionOpening: (subject) =>
        `${subject.title} — ${subject.storeName}-এর বাছাই করা সংগ্রহ, ${priceLabel(subject)}।`,
      fallbackFeatures: (subject) => [
        `বাছাই করা ${subjectNoun(subject)}`,
        "যত্ন করে নির্বাচিত উপকরণ",
        `মূল্য ${priceLabel(subject)}`,
        "নিরাপদ প্যাকেজিং ও ডেলিভারি"
      ],
      metaOpening: (subject) =>
        `${subject.title} — ${subject.storeName}-এর প্রিমিয়াম সংগ্রহ, ${priceLabel(subject)}।`,
      shortDescription: (subject) => `${subject.title} — বাছাই করা মান, ${priceLabel(subject)}।`,
      socialOpening: (subject) => `✨ ${subject.title}। ${priceLabel(subject)}।`,
      trustLine: "প্রতিটি পণ্য পাঠানোর আগে হাতে পরীক্ষা করা হয়।"
    },
    professional: {
      benefit: (subject) =>
        `${subjectNoun(subject)} হিসেবে এটি দৈনন্দিন ব্যবহারের চাহিদা পূরণ করার জন্য নির্বাচিত।`,
      callToAction: "অর্ডার করতে পণ্যের পাতায় যান।",
      descriptionOpening: (subject) =>
        `${subject.title}, ${subject.storeName}-এর ক্যাটালগে ${priceLabel(subject)} মূল্যে উপলব্ধ।`,
      fallbackFeatures: (subject) => [
        `শ্রেণি: ${subjectNoun(subject)}`,
        `মূল্য: ${priceLabel(subject)}`,
        ...(subject.sku ? [`পণ্য কোড: ${subject.sku}`] : []),
        "সারা দেশে ডেলিভারি"
      ],
      metaOpening: (subject) =>
        `${subject.title} — ${priceLabel(subject)}। ${subject.storeName}-এ উপলব্ধ।`,
      shortDescription: (subject) => `${subject.title} — ${priceLabel(subject)}।`,
      socialOpening: (subject) => `${subject.title} এখন স্টকে। মূল্য ${priceLabel(subject)}।`,
      trustLine: "স্টক ও ডেলিভারির তথ্যের জন্য পণ্যের পাতা দেখুন।"
    }
  },
  en: {
    friendly: {
      benefit: (subject) =>
        `It is an easy, dependable pick for anyone shopping for ${subjectNoun(subject).toLowerCase()} they will actually use every day.`,
      callToAction: "Order yours today.",
      descriptionOpening: (subject) =>
        `Meet the ${subject.title}, now in stock at ${subject.storeName} for ${priceLabel(subject)}.`,
      fallbackFeatures: (subject) => [
        `Picked for ${subjectNoun(subject).toLowerCase()} that lasts`,
        `Priced at ${priceLabel(subject)}`,
        "Delivered nationwide",
        "Cash on delivery available"
      ],
      metaOpening: (subject) =>
        `Buy the ${subject.title} for ${priceLabel(subject)} at ${subject.storeName}.`,
      shortDescription: (subject) =>
        `${subject.title} — ${priceLabel(subject)}, delivered fast from ${subject.storeName}.`,
      socialOpening: (subject) =>
        `🎉 Just landed: the ${subject.title}, only ${priceLabel(subject)}.`,
      trustLine: "Questions? Send us a message — we answer every one."
    },
    premium: {
      benefit: (subject) =>
        `Made for buyers who do not compromise on ${subjectNoun(subject).toLowerCase()}.`,
      callToAction: "Limited stock — claim yours.",
      descriptionOpening: (subject) =>
        `The ${subject.title}, part of the curated selection at ${subject.storeName}, at ${priceLabel(subject)}.`,
      fallbackFeatures: (subject) => [
        `Curated ${subjectNoun(subject).toLowerCase()}`,
        "Carefully chosen materials",
        `Priced at ${priceLabel(subject)}`,
        "Protective packaging on every order"
      ],
      metaOpening: (subject) =>
        `${subject.title} — a curated pick from ${subject.storeName} at ${priceLabel(subject)}.`,
      shortDescription: (subject) =>
        `${subject.title} — curated quality at ${priceLabel(subject)}.`,
      socialOpening: (subject) => `✨ ${subject.title}. ${priceLabel(subject)}.`,
      trustLine: "Every piece is checked by hand before it ships."
    },
    professional: {
      benefit: (subject) =>
        `Selected to meet everyday requirements for ${subjectNoun(subject).toLowerCase()}.`,
      callToAction: "See the product page to order.",
      descriptionOpening: (subject) =>
        `${subject.title} is available in the ${subject.storeName} catalogue at ${priceLabel(subject)}.`,
      fallbackFeatures: (subject) => [
        `Category: ${subjectNoun(subject)}`,
        `Price: ${priceLabel(subject)}`,
        ...(subject.sku ? [`Product code: ${subject.sku}`] : []),
        "Nationwide delivery"
      ],
      metaOpening: (subject) =>
        `${subject.title} at ${priceLabel(subject)}, available from ${subject.storeName}.`,
      shortDescription: (subject) => `${subject.title} — ${priceLabel(subject)}.`,
      socialOpening: (subject) => `${subject.title} is in stock at ${priceLabel(subject)}.`,
      trustLine: "Check the product page for current stock and delivery times."
    }
  }
};

function splitLines(value: string | null) {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

function splitList(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** Case-insensitive whole-value containment, so "Nike" is not re-appended to "Nike Air". */
function includesWord(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}

/** Cut on a word boundary where one is close by, so a draft never ends mid-word. */
function clamp(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  const cut = value.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");

  return (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
}
