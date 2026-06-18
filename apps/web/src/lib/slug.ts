export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeSlug(value: string) {
  return slugify(value);
}

export async function createUniqueSlug(
  baseValue: string,
  isAvailable: (slug: string) => Promise<boolean>
) {
  const baseSlug = slugify(baseValue) || "item";

  for (let attempt = 0; attempt < 50; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;

    if (await isAvailable(slug)) {
      return slug;
    }
  }

  return `${baseSlug}-${Date.now()}`;
}
