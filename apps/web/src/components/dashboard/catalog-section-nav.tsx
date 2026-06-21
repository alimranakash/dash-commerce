import Link from "next/link";

type CatalogSectionNavProps = {
  active: "all" | "create";
  baseHref: string;
  pluralLabel: string;
  singularLabel: string;
};

export function CatalogSectionNav({ active, baseHref, pluralLabel, singularLabel }: CatalogSectionNavProps) {
  const links = [
    { href: baseHref, id: "all", label: `All ${pluralLabel}` },
    { href: `${baseHref}/new`, id: "create", label: `Create ${singularLabel}` }
  ] as const;

  return (
    <nav aria-label={`${pluralLabel} management`} className="flex flex-wrap gap-2 border-b border-[#e9e7f2] pb-3">
      {links.map((link) => (
        <Link
          aria-current={active === link.id ? "page" : undefined}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${active === link.id ? "bg-[#f3f0ff] text-[#6d3cf5]" : "text-[#555765] hover:bg-[#f8f7ff]"}`}
          href={link.href}
          key={link.id}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
