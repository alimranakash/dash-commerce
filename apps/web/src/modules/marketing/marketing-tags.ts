import { marketingIdPatterns, type MarketingIdField } from "./marketing.schema";
import { validateCustomTrackingCode } from "./marketing-code";

/**
 * Turns stored marketing settings into the exact tags a storefront should render.
 *
 * Every ID is re-validated here against the same pattern the settings form used.
 * Save-time validation is not load-bearing for safety: a row edited straight in
 * the database, or written by an older build, must not be able to reach the
 * page. Anything that fails is dropped silently — a broken pixel is not worth
 * breaking a storefront over.
 *
 * Because the patterns admit only `[A-Za-z0-9_-]`, an ID can never terminate the
 * quoted string it is interpolated into, which is what makes these templates
 * safe to build by concatenation.
 */

export type MarketingTag =
  | { code: string; id: string; kind: "inline" }
  | { html: string; id: string; kind: "html"; noscript: boolean }
  | { id: string; kind: "external"; src: string };

export type MarketingTagPlan = {
  bodyEnd: MarketingTag[];
  bodyStart: MarketingTag[];
  head: MarketingTag[];
  /** Verification tags, emitted through `generateMetadata` rather than the body. */
  meta: { content: string; name: string }[];
};

export type MarketingTagSource = {
  customBodyCode?: string | null;
  customEnabled?: boolean;
  customFooterCode?: string | null;
  customHeaderCode?: string | null;
  ga4MeasurementId?: string | null;
  googleAdsConversionId?: string | null;
  googleSiteVerification?: string | null;
  gtmContainerId?: string | null;
  metaDomainVerification?: string | null;
  metaPixelId?: string | null;
  tiktokPixelId?: string | null;
};

export const emptyMarketingTagPlan: MarketingTagPlan = {
  bodyEnd: [],
  bodyStart: [],
  head: [],
  meta: []
};

export function buildMarketingTags(source: MarketingTagSource | null): MarketingTagPlan {
  if (!source) {
    return emptyMarketingTagPlan;
  }

  const ga4 = validId("ga4MeasurementId", source.ga4MeasurementId);
  const gtm = validId("gtmContainerId", source.gtmContainerId);
  const ads = validId("googleAdsConversionId", source.googleAdsConversionId);
  const pixel = validId("metaPixelId", source.metaPixelId);
  const tiktok = validId("tiktokPixelId", source.tiktokPixelId);
  const googleVerification = validId("googleSiteVerification", source.googleSiteVerification);
  const metaVerification = validId("metaDomainVerification", source.metaDomainVerification);

  const head: MarketingTag[] = [];
  const bodyStart: MarketingTag[] = [];
  const bodyEnd: MarketingTag[] = [];
  const meta: { content: string; name: string }[] = [];

  // GA4 and Google Ads are both gtag.js. Loading the library twice would double
  // every event, so one loader takes the first configured ID and each product
  // gets its own `config` line.
  const gtagIds = [ga4, ads].filter((value): value is string => Boolean(value));

  if (gtagIds[0]) {
    head.push({
      id: "marketing-gtag-src",
      kind: "external",
      src: `https://www.googletagmanager.com/gtag/js?id=${gtagIds[0]}`
    });
    head.push({
      code: [
        "window.dataLayer = window.dataLayer || [];",
        "function gtag(){dataLayer.push(arguments);}",
        "gtag('js', new Date());",
        ...gtagIds.map((id) => `gtag('config', '${id}');`)
      ].join("\n"),
      id: "marketing-gtag-init",
      kind: "inline"
    });
  }

  if (gtm) {
    head.push({
      code: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`,
      id: "marketing-gtm",
      kind: "inline"
    });
    // GTM's own snippet puts this immediately after <body> opens.
    bodyStart.push({
      html: `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtm}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
      id: "marketing-gtm-noscript",
      kind: "html",
      noscript: true
    });
  }

  if (pixel) {
    head.push({
      code: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');\nfbq('init', '${pixel}');\nfbq('track', 'PageView');`,
      id: "marketing-meta-pixel",
      kind: "inline"
    });
    bodyEnd.push({
      html: `<img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${pixel}&ev=PageView&noscript=1" />`,
      id: "marketing-meta-pixel-noscript",
      kind: "html",
      noscript: true
    });
  }

  if (tiktok) {
    head.push({
      code: `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${tiktok}');ttq.page();}(window,document,'ttq');`,
      id: "marketing-tiktok-pixel",
      kind: "inline"
    });
  }

  if (googleVerification) {
    meta.push({ content: googleVerification, name: "google-site-verification" });
  }

  if (metaVerification) {
    meta.push({ content: metaVerification, name: "facebook-domain-verification" });
  }

  if (source.customEnabled) {
    pushCustom(head, source.customHeaderCode, "header");
    pushCustom(bodyStart, source.customBodyCode, "body");
    pushCustom(bodyEnd, source.customFooterCode, "footer");
  }

  return { bodyEnd, bodyStart, head, meta };
}

/**
 * Splits seller-supplied markup so scripts actually run.
 *
 * `dangerouslySetInnerHTML` does not execute `<script>` it inserts, so script
 * tags are pulled out and handed to the renderer as real script elements; the
 * remaining markup (meta, img, noscript, …) needs no execution and is injected
 * as-is. The allowlist runs first, so nothing unvetted reaches either path.
 */
function pushCustom(target: MarketingTag[], code: string | null | undefined, slot: string) {
  const trimmed = code?.trim();

  if (!trimmed || validateCustomTrackingCode(trimmed).length > 0) {
    return;
  }

  let index = 0;

  const remainder = trimmed.replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,
    (_match, attributes: string, body: string) => {
      const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1];

      index += 1;

      if (src) {
        target.push({ id: `marketing-custom-${slot}-${index}`, kind: "external", src });
      } else if (body.trim()) {
        target.push({ code: body, id: `marketing-custom-${slot}-${index}`, kind: "inline" });
      }

      return "";
    }
  );

  if (remainder.trim()) {
    target.push({
      html: remainder,
      id: `marketing-custom-${slot}-html`,
      kind: "html",
      noscript: false
    });
  }
}

function validId(field: MarketingIdField, value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed && marketingIdPatterns[field].test(trimmed) ? trimmed : null;
}
