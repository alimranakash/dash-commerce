import type { Metadata } from "next";
import { headers } from "next/headers";
import { normalizeDomainInput, validateDomainHostname } from "../../modules/domains/domains.schema";
import { findDomainOwner } from "../../modules/domains/domains.repository";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false
  },
  title: "Domain not connected | Dash Commerce OS"
};

/**
 * Where `proxy.ts` sends a custom domain it could not resolve to a live store.
 *
 * The proxy deliberately makes only the one "may this host be served" query, so
 * the reason lands here: this page is off the hot path and can afford a second
 * lookup to tell a seller mid-setup ("DNS points here, verification pending")
 * apart from a hostname nobody has connected at all.
 */
export default async function DomainNotConfiguredPage() {
  const requestHeaders = await headers();
  const hostname = normalizeDomainInput(requestHeaders.get("host") ?? "");
  const isDisplayableHostname = hostname !== "" && validateDomainHostname(hostname) === null;
  const owner = isDisplayableHostname ? await findDomainOwner(hostname) : null;
  const state = owner ? (owner.verifiedAt ? "unavailable" : "pending") : "unconnected";

  return (
    <main className="grid min-h-screen place-items-center bg-[#fafaff] px-6 py-16">
      <section className="w-full max-w-lg rounded-2xl border border-[#dedceb] bg-white p-8 text-center shadow-sm">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[#858691]">
          {state === "pending" ? "Verification pending" : "Domain not connected"}
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-[#34353f]">
          {isDisplayableHostname ? hostname : "This domain"}
        </h1>
        <p className="mt-4 text-sm leading-6 text-[#565762]">
          {state === "pending"
            ? "This domain is connected to a store but has not been verified yet. Once its DNS records are in place and verification passes, the storefront will appear here."
            : state === "unavailable"
              ? "This domain is connected to a store that is not currently open. Please check back later."
              : "This domain is not connected to a store on Dash Commerce OS. If you own it, add it under Settings → Domains and point your DNS records at us."}
        </p>
        <a
          className="mt-6 inline-block rounded-lg bg-[#34353f] px-5 py-2.5 text-sm font-semibold text-white no-underline"
          href="https://dash.com"
        >
          Go to Dash Commerce OS
        </a>
      </section>
    </main>
  );
}
