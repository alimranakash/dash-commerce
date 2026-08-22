"use client";

import { ArrowLeft, ArrowRight, BriefcaseBusiness, Check, Globe2, LoaderCircle, MapPin, Sparkles, Store, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import styles from "./onboarding-experience.module.css";
import { businessTypes, countryOptions, isBusinessType, isCountryName, slugify, type BusinessType, type CountryName } from "./options";

type Draft = { businessType: BusinessType; country: CountryName; storeName: string; storeSlug: string };
const initialDraft: Draft = { businessType: "General Store", country: "Bangladesh", storeName: "", storeSlug: "" };

export function OnboardingForm({ platformDomain }: { platformDomain: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [step, setStep] = useState(1);
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const country = countryOptions[draft.country];
  const previewDomain = useMemo(() => `${draft.storeSlug || "yourstore"}.${platformDomain}`, [draft.storeSlug, platformDomain]);

  // Only reachable now when registration could not create the store itself, or
  // when the account came from Google and never answered these questions.
  useEffect(() => {
    const savedDraft = sessionStorage.getItem("dash-store-setup-draft");
    if (!savedDraft) return;
    try {
      const parsed = JSON.parse(savedDraft) as { businessType?: unknown; country?: unknown; storeName?: unknown; storeSlug?: unknown };
      setDraft((current) => ({
        businessType: isBusinessType(parsed.businessType) ? parsed.businessType : current.businessType,
        country: isCountryName(parsed.country) ? parsed.country : current.country,
        storeName: typeof parsed.storeName === "string" ? parsed.storeName : current.storeName,
        storeSlug: typeof parsed.storeSlug === "string" ? parsed.storeSlug : current.storeSlug
      }));
      setSlugEdited(typeof parsed.storeSlug === "string" && parsed.storeSlug.length > 0);
    } catch {
      sessionStorage.removeItem("dash-store-setup-draft");
    }
  }, []);

  function setStoreName(value: string) {
    setDraft((current) => ({ ...current, storeName: value, storeSlug: slugEdited ? current.storeSlug : slugify(value) }));
    setError(null);
  }

  function validateStep() {
    if (step === 1 && draft.storeName.trim().length < 2) return "Store name is required.";
    if (step === 2 && !/^[a-z0-9-]{3,40}$/.test(draft.storeSlug)) return "Use 3-40 lowercase letters, numbers, or hyphens.";
    if (step === 2 && (draft.storeSlug.startsWith("-") || draft.storeSlug.endsWith("-"))) return "Slug cannot start or end with a hyphen.";
    if (step === 3 && draft.businessType.length < 2) return "Business type is required.";
    if (step === 4 && !country) return "Country is required.";
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    if (step < 5) { const validation = validateStep(); if (validation) { setError(validation); return; } setStep((current) => current + 1); return; }

    setIsSubmitting(true);
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationName: draft.storeName,
        storeName: draft.storeName,
        storeSlug: draft.storeSlug,
        businessType: draft.businessType,
        country: draft.country,
        currency: country.currency,
        timezone: country.timezone
      })
    });

    if (!response.ok) { const body = (await response.json().catch(() => null)) as { error?: string } | null; setError(body?.error ?? "Workspace setup failed."); setIsSubmitting(false); return; }
    sessionStorage.removeItem("dash-store-setup-draft");
    router.refresh();
  }

  return (
    <div className={styles.flowLayout}>
      <section className={styles.formCard}>
        <header className={styles.progressHeader}><div><span>Step {step} of 5</span><b>{stepTitles[step - 1]}</b></div><div className={styles.progressTrack}><i style={{ width: `${step * 20}%` }} /></div></header>
        <form className={styles.stepForm} onSubmit={handleSubmit}>
          <div className={styles.stepBody}>
            {step === 1 ? <StoreNameStep value={draft.storeName} onChange={setStoreName} /> : null}
            {step === 2 ? <StoreUrlStep domain={previewDomain} platformDomain={platformDomain} value={draft.storeSlug} onChange={(value) => { setSlugEdited(true); setDraft((current) => ({ ...current, storeSlug: slugify(value) })); setError(null); }} /> : null}
            {step === 3 ? <BusinessStep value={draft.businessType} onChange={(value) => { setDraft((current) => ({ ...current, businessType: value })); setError(null); }} /> : null}
            {step === 4 ? <CountryStep country={draft.country} onChange={(value) => { setDraft((current) => ({ ...current, country: value })); setError(null); }} /> : null}
            {step === 5 ? <FinishStep country={country} draft={draft} domain={previewDomain} /> : null}
          </div>
          {error ? <p className={styles.errorMessage}>{error}</p> : null}
          <footer className={styles.stepActions}>{step > 1 ? <button className={styles.backButton} disabled={isSubmitting} onClick={() => { setStep((current) => current - 1); setError(null); }} type="button"><ArrowLeft /> Back</button> : <span />}<button className={styles.nextButton} disabled={isSubmitting} type="submit">{isSubmitting ? <><LoaderCircle className={styles.spinner} /> Creating your workspace...</> : step === 5 ? <>Create Workspace <Sparkles /></> : <>Continue <ArrowRight /></>}</button></footer>
        </form>
        {isSubmitting ? <div className={styles.loadingOverlay} role="status"><span><LoaderCircle /></span><h3>Creating your workspace...</h3><p>Preparing your store, domain, payments, shipping, and settings.</p></div> : null}
      </section>
      <StorePreview country={draft.country} currency={country.currency} domain={previewDomain} name={draft.storeName} />
    </div>
  );
}

function StoreNameStep({ onChange, value }: { onChange: (value: string) => void; value: string }) { return <StepIntro icon={Store} eyebrow="Your store identity" title="What should we call your store?" text="Choose the customer-facing name for your new commerce brand."><label className={styles.fieldLabel}>Store Name<div className={styles.inputShell}><Store /><input autoFocus maxLength={100} onChange={(event) => onChange(event.target.value)} placeholder="Akash Atelier" value={value} /></div><small>You can update this later from store settings.</small></label></StepIntro>; }
function StoreUrlStep({ domain, onChange, platformDomain, value }: { domain: string; onChange: (value: string) => void; platformDomain: string; value: string }) { return <StepIntro icon={Globe2} eyebrow="Your home on StoreIM" title="Claim your store URL." text="Keep it short, memorable, and easy to share with customers."><label className={styles.fieldLabel}>Store URL<div className={styles.slugInput}><span>https://</span><input autoFocus maxLength={40} onChange={(event) => onChange(event.target.value)} placeholder="yourstore" value={value} /><b>.{platformDomain}</b></div><small>Preview: {domain}</small></label></StepIntro>; }
function BusinessStep({ onChange, value }: { onChange: (value: BusinessType) => void; value: BusinessType }) { return <StepIntro icon={BriefcaseBusiness} eyebrow="Tailor your workspace" title="What kind of business are you building?" text="This helps StoreIM prepare a more relevant starting experience."><div className={styles.optionGrid}>{businessTypes.map((type) => <button className={value === type ? styles.optionActive : ""} onClick={() => onChange(type)} type="button" key={type}><span>{type.charAt(0)}</span><b>{type}</b>{value === type ? <Check /> : null}</button>)}</div></StepIntro>; }
function CountryStep({ country, onChange }: { country: CountryName; onChange: (value: CountryName) => void }) { const config = countryOptions[country]; return <StepIntro icon={MapPin} eyebrow="Localize your store" title="Where is your business based?" text="We’ll automatically configure the right currency and timezone."><label className={styles.fieldLabel}>Country<select autoFocus onChange={(event) => onChange(event.target.value as CountryName)} value={country}>{Object.keys(countryOptions).map((name) => <option key={name}>{name}</option>)}</select></label><div className={styles.autoConfig}><div><WalletCards /><span><small>Currency</small><b>{config.currency}</b></span></div><div><Globe2 /><span><small>Timezone</small><b>{config.timezone}</b></span></div></div></StepIntro>; }
function FinishStep({ country, domain, draft }: { country: (typeof countryOptions)[CountryName]; domain: string; draft: Draft }) { return <StepIntro icon={Sparkles} eyebrow="Ready to launch" title="Your workspace is ready to be created." text="Review the essentials. StoreIM will prepare the rest automatically."><div className={styles.reviewList}><Review label="Store" value={draft.storeName} /><Review label="Domain" value={domain} /><Review label="Business" value={draft.businessType} /><Review label="Location" value={`${draft.country} · ${country.currency}`} /></div><p className={styles.creationNote}><Check /> Default payments, shipping zones, theme settings, and StoreOS connection will be prepared.</p></StepIntro>; }
function StepIntro({ children, eyebrow, icon: Icon, text, title }: { children: ReactNode; eyebrow: string; icon: typeof Store; text: string; title: string }) { return <div className={styles.stepContent}><span className={styles.stepIcon}><Icon /></span><div className={styles.stepCopy}><small>{eyebrow}</small><h2>{title}</h2><p>{text}</p></div>{children}</div>; }
function Review({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><b>{value}</b></div>; }
function StorePreview({ country, currency, domain, name }: { country: string; currency: string; domain: string; name: string }) { return <aside className={styles.previewCard}><header><span>Live store preview</span><i><b /> Ready</i></header><div className={styles.storefrontMock}><nav><strong>{name || "YOUR STORE"}</strong><span>Shop&nbsp;&nbsp; About&nbsp;&nbsp; Contact</span></nav><section><small>WELCOME TO</small><h2>{name || "Your next great store"}</h2><p>Thoughtfully selected products, ready for your customers.</p><button type="button">Explore collection</button></section><footer><span>{domain}</span><b>{country} · {currency}</b></footer></div><div className={styles.previewFacts}><div><span>Store Name</span><b>{name || "Not set yet"}</b></div><div><span>Store URL</span><b>{domain}</b></div><div><span>Country</span><b>{country}</b></div><div><span>Currency</span><b>{currency}</b></div></div></aside>; }

const stepTitles = ["Store Name", "Store URL", "Business Type", "Country & Region", "Create Workspace"];
