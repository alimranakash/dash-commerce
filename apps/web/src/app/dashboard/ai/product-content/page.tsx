import { Sparkles } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { saveAiContentDefaultsAction } from "../../../../modules/ai-provider/ai-provider.actions";
import {
  AI_PROVIDER_META,
  isProviderReady
} from "../../../../modules/ai-provider/ai-provider.schema";
import { getAiSettingsView } from "../../../../modules/ai-provider/ai-provider.service";
import { AiContentDefaultsForm } from "../../../../modules/ai-provider/components/ai-content-defaults-form";
import { BILLING_UPGRADE_PATH } from "../../../../modules/billing/components/paid-badge";
import {
  PRODUCT_CONTENT_FIELD_META,
  PRODUCT_CONTENT_FIELDS
} from "../../../../modules/product-content/product-content.schema";
import { canGenerateProductContent } from "../../../../modules/product-content/product-content.service";
import { getProductPageForStore } from "../../../../modules/products/product.service";
import { getStoreAccess } from "../../../../modules/stores/queries";

/** How many products the picker lists before asking the seller to use Products. */
const PICKER_LIMIT = 12;

/**
 * Dashboard → StoreIM AI → AI Product Content.
 *
 * The hub for everything the content studio needs but a single product does
 * not own: which engine is answering, the register drafts start from, and a way
 * into a product's studio without going through the catalogue first.
 *
 * `getStoreAccess()` rather than `requireStore()`, matching StoreIM AI > Settings:
 * a member may read which provider is configured and open any product's studio,
 * while the defaults form is a manager's and its action refuses anyone else.
 */
export default async function AiProductContentPage() {
  const access = await getStoreAccess();
  const [settings, aiEnabled, products] = await Promise.all([
    getAiSettingsView(access.store.id),
    canGenerateProductContent(access.store.id),
    getProductPageForStore({ storeId: access.store.id, take: PICKER_LIMIT })
  ]);
  const provider = settings.defaultProvider;
  // Two different questions: whether the chosen provider has what it needs, and
  // whether anything at all can generate. The built-in engine passes the first
  // on every store and fails the second on a plan without StoreIM AI, so a page
  // that reported only the first would say "Ready" over dead buttons.
  const providerReady = isProviderReady(settings, provider) && aiEnabled;

  return (
    <DashboardShell storeSlug={access.store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">StoreIM AI</p>
            <h1>AI Product Content</h1>
            <p className="auth-copy">
              Product titles, descriptions, highlights, SEO fields, and social captions — written
              from your own catalogue.
            </p>
          </div>
        </div>

        {aiEnabled ? null : (
          <p className="ai-studio-warning">
            Generating is off: this store&apos;s plan does not include AI Product Content.{" "}
            <Link href={BILLING_UPGRADE_PATH}>See plans</Link> to unlock it. A Gemini or OpenAI key
            of your own chooses which engine writes the drafts once the plan includes the studio; it
            does not open the studio on its own. Every content field can still be written and saved
            by hand.
          </p>
        )}

        <section className="product-editor-card">
          <header>
            <h2>Engine</h2>
            <p>Which engine writes this store&apos;s product copy today.</p>
          </header>
          <div className="product-editor-card-body">
            <dl className="ai-content-status">
              <dt>Provider</dt>
              <dd>{AI_PROVIDER_META[provider].label}</dd>
              <dt>Status</dt>
              <dd>
                {providerReady
                  ? "Ready"
                  : provider === "storeos"
                    ? "Not available on this plan — upgrade to unlock it"
                    : `No ${AI_PROVIDER_META[provider].label} key stored — drafts fall back`}
              </dd>
              <dt>Model</dt>
              <dd>
                {provider === "gemini"
                  ? settings.geminiModel
                  : provider === "openai"
                    ? settings.openaiModel
                    : "Chosen by StoreIM AI"}
              </dd>
            </dl>
            <p className="ai-studio-meta">
              If the chosen engine cannot answer, StoreIM AI is tried next, and then a draft composed
              from the product&apos;s own details. Every draft says which of the three wrote it.
            </p>
            <p>
              <Link className="secondary link-button" href="/dashboard/ai/settings">
                Change provider or API key
              </Link>
            </p>
          </div>
        </section>

        <AiContentDefaultsForm
          action={saveAiContentDefaultsAction}
          canManage={access.canManage}
          settings={settings}
        />

        <section className="product-editor-card">
          <header>
            <h2>What gets written</h2>
            <p>Every field the studio and the inline buttons can fill in.</p>
          </header>
          <div className="product-editor-card-body">
            <ul className="ai-content-field-list">
              {PRODUCT_CONTENT_FIELDS.map((field) => (
                <li key={field}>
                  <strong>{PRODUCT_CONTENT_FIELD_META[field].label}</strong>
                  <span>{PRODUCT_CONTENT_FIELD_META[field].description}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="product-editor-card">
          <header>
            <h2>Open a product&apos;s studio</h2>
            <p>
              The {products.length} most recent products. Any product can be opened from Products.
            </p>
          </header>
          <div className="product-editor-card-body">
            {products.length === 0 ? (
              <p className="ai-studio-meta">
                No products yet. <Link href="/dashboard/products/new">Add one</Link> and the studio
                will have something to write about.
              </p>
            ) : (
              <ul className="ai-content-product-list">
                {products.map((product) => (
                  <li key={product.id}>
                    <div>
                      <strong>{product.title}</strong>
                      <span>{product.category?.name ?? "Uncategorised"}</span>
                    </div>
                    <Link
                      className="ai-studio-ghost-button"
                      href={`/dashboard/products/${product.id}/content`}
                    >
                      <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                      Open studio
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </section>
    </DashboardShell>
  );
}
