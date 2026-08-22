"use client";

import { ArrowLeft, ArrowRight, BriefcaseBusiness, Check, CircleAlert, Eye, EyeOff, LoaderCircle, LockKeyhole, MapPin, MessageSquare, Sparkles, Store, UserRound } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import ob from "../onboarding/onboarding-experience.module.css";
import { businessTypes, countryOptions, currencyOptions, slugify, storeSlugPattern, timezoneOptions, type BusinessType, type CountryName } from "../onboarding/options";
import { StepIntro, StorePreview } from "../onboarding/wizard-shell";
import { AuthExperience } from "./auth-experience";
import styles from "./auth-experience.module.css";
import { CodeInput, codeLength } from "./code-input";
import { GoogleAuthButton } from "./google-auth-button";
import { parseAccountIdentifier } from "./identifier";

type Draft = { businessType: BusinessType; country: CountryName; currency: string; identifier: string; name: string; password: string; storeName: string; storeSlug: string; timezone: string };
/** The free-text fields. `businessType` and `country` are unions and get their own setters. */
type DraftText = "identifier" | "name" | "password" | "storeName" | "storeSlug";
type Challenge = { channel: "EMAIL" | "SMS"; devCode: string | null; identifier: string };
type ErrorBody = { attemptsRemaining?: number; code?: string; error?: string; retryAfterSeconds?: number };
type SlugCheck = { message: string | null; slug: string; state: "available" | "checking" | "taken" | "unknown" };
type SlugTheme = { available: string | undefined; base: string | undefined; spinner: string | undefined; taken: string | undefined };
type TicketBody = { channel: "EMAIL" | "SMS"; devCode?: string; identifier: string; resendAvailableAt: string };

const initialDraft: Draft = { businessType: "General Store", country: "Bangladesh", currency: countryOptions.Bangladesh.currency, identifier: "", name: "", password: "", storeName: "", storeSlug: "", timezone: countryOptions.Bangladesh.timezone };
const verifyStep = 2;
const storeStep = 3;
const businessStep = 4;
const regionStep = 5;

/**
 * Fails open, deliberately. `createOnboardingWorkspace` re-checks the slug
 * inside its transaction and that is the check that decides, so a network blip
 * here must never be able to block a URL that is in fact free.
 */
async function fetchSlugAvailability(slug: string): Promise<SlugCheck> {
  try {
    const response = await fetch(`/api/onboarding/slug?slug=${encodeURIComponent(slug)}`);
    const body = (await response.json().catch(() => null)) as { available?: boolean; message?: string | null } | null;

    if (!body || typeof body.available !== "boolean") {
      return { message: null, slug, state: "unknown" };
    }

    return body.available ? { message: null, slug, state: "available" } : { message: body.message ?? "This store URL is not available.", slug, state: "taken" };
  } catch {
    return { message: null, slug, state: "unknown" };
  }
}

/** Settles an onboarding POST whose answer never arrived, or that failed because an earlier attempt had already committed. */
async function hasWorkspace() {
  try {
    const response = await fetch("/api/onboarding");
    const body = (await response.json().catch(() => null)) as { hasStore?: boolean } | null;

    return body?.hasStore === true;
  } catch {
    return false;
  }
}

export function RegisterForm({ platformDomain }: { platformDomain: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  /**
   * Set when the visitor arrived from an invite link. Someone joining an
   * existing team must not be walked through creating a store — they are
   * joining one that already exists — so those steps are dropped and they are
   * handed back to the invite once the account exists.
   */
  const inviteToken = searchParams?.get("invite") ?? null;
  const stepLabels = inviteToken ? ["Account", "Verify", "Finish"] : ["Account", "Verify", "Store", "Business", "Region", "Finish"];
  const lastStep = stepLabels.length;
  const [draft, setDraft] = useState(initialDraft);
  const [step, setStep] = useState(1);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState("");
  const [slugCheck, setSlugCheck] = useState<SlugCheck | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  /**
   * The account exists from the moment the code is confirmed, so no step before
   * that can be revisited: the challenge behind it has been consumed, and going
   * back would only produce an error nobody can act on.
   */
  const [verified, setVerified] = useState(false);
  const firstBackStep = verified ? verifyStep + 1 : 1;
  const secondsLeft = resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));
  /**
   * Naming a store is store setup, not sign-up, so from that step on the page
   * becomes the same wizard the dashboard shows — full width, live preview of
   * the storefront being described. An invited member never gets here.
   */
  const usesWizard = !inviteToken && step >= storeStep;
  const previewDomain = `${draft.storeSlug || "yourstore"}.${platformDomain}`;

  useEffect(() => {
    if (step !== verifyStep) {
      return;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [step]);

  // Answers the URL question while they are still typing it, so a taken or
  // reserved slug never survives to the end of the form.
  useEffect(() => {
    if (inviteToken || step !== storeStep || !storeSlugPattern.test(draft.storeSlug)) {
      setSlugCheck(null);
      return;
    }

    let cancelled = false;
    setSlugCheck({ message: null, slug: draft.storeSlug, state: "checking" });

    const timer = window.setTimeout(() => {
      void fetchSlugAvailability(draft.storeSlug).then((outcome) => {
        if (!cancelled) {
          setSlugCheck(outcome);
        }
      });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [draft.storeSlug, inviteToken, step]);

  function update(field: DraftText, value: string) {
    setDraft((current) => ({ ...current, [field]: value, ...(field === "storeName" ? { storeSlug: slugify(value) } : {}) }));
    setError(null);
  }

  function selectBusinessType(value: BusinessType) {
    setDraft((current) => ({ ...current, businessType: value }));
    setError(null);
  }

  /** Currency and timezone follow the country until the seller overrides either one on the same step. */
  function selectCountry(value: CountryName) {
    const config = countryOptions[value];

    setDraft((current) => ({ ...current, country: value, currency: config.currency, timezone: config.timezone }));
    setError(null);
  }

  function validateCurrentStep() {
    if (step === 1) {
      if (draft.name.trim().length < 2) return "Enter your full name.";
      if (!parseAccountIdentifier(draft.identifier)) return "Enter a valid email address or Bangladesh mobile number.";
      if (draft.password.length < 8) return "Password must be at least 8 characters.";
    }
    if (step === storeStep && !inviteToken) {
      if (draft.storeName.trim().length < 2) return "Enter your store name.";
      if (!storeSlugPattern.test(draft.storeSlug)) return "Store URL must use 3–40 lowercase letters, numbers, or hyphens.";
    }
    return null;
  }

  function openChallenge(ticket: TicketBody, message: string | null) {
    setChallenge({ channel: ticket.channel, devCode: ticket.devCode ?? null, identifier: ticket.identifier });
    setResendAt(new Date(ticket.resendAvailableAt).getTime());
    setNow(Date.now());
    setNotice(message);
    setCode("");
  }

  async function requestCode() {
    const response = await fetch("/api/auth/otp/request", {
      body: JSON.stringify({ identifier: draft.identifier, name: draft.name, password: draft.password }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    const body = (await response.json().catch(() => null)) as (ErrorBody & Partial<TicketBody>) | null;

    return { body, ok: response.ok };
  }

  async function startVerification() {
    const { body, ok } = await requestCode();

    if (ok && body?.channel && body.identifier && body.resendAvailableAt) {
      openChallenge(body as TicketBody, null);
      setStep(verifyStep);
      return;
    }

    // A code is already in flight and still valid, so holding them on this step
    // gains nothing — send them on to type the one they already have.
    if (body?.code === "COOLDOWN") {
      const parsed = parseAccountIdentifier(draft.identifier);

      openChallenge(
        {
          channel: parsed?.channel ?? "EMAIL",
          identifier: parsed === null ? draft.identifier : parsed.channel === "EMAIL" ? parsed.email : parsed.phone,
          resendAvailableAt: new Date(Date.now() + (body.retryAfterSeconds ?? 60) * 1000).toISOString()
        },
        "A code was already sent. Enter it below, or wait to send another."
      );
      setStep(verifyStep);
      return;
    }

    setError(body?.error ?? "We could not send your code. Try again.");
  }

  async function submitCode() {
    const response = await fetch("/api/auth/otp/verify", {
      body: JSON.stringify({ code, identifier: draft.identifier }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });

    if (response.ok) {
      setVerified(true);
      setNotice(null);
      setStep(verifyStep + 1);
      return;
    }

    const body = (await response.json().catch(() => null)) as ErrorBody | null;
    setCode("");

    // All three mean the code on their screen is dead, so the resend button has
    // to become available now rather than at the end of its cooldown.
    if (body?.code === "EXPIRED" || body?.code === "TOO_MANY_ATTEMPTS" || body?.code === "CHALLENGE_NOT_FOUND") {
      setResendAt(null);
    }

    const attempts = body?.attemptsRemaining;
    setError(
      attempts === undefined
        ? (body?.error ?? "That code did not work.")
        : `${body?.error ?? "That code is not right."} ${attempts} ${attempts === 1 ? "try" : "tries"} left.`
    );
  }

  async function resendCode() {
    setIsResending(true);
    setError(null);
    setNotice(null);

    const { body, ok } = await requestCode();

    if (ok && body?.channel && body.identifier && body.resendAvailableAt) {
      openChallenge(body as TicketBody, "A new code is on its way.");
    } else if (body?.code === "COOLDOWN") {
      setResendAt(Date.now() + (body.retryAfterSeconds ?? 60) * 1000);
      setNow(Date.now());
      setError(body.error ?? "Wait a moment before asking for another code.");
    } else {
      setError(body?.error ?? "We could not send another code.");
    }

    setIsResending(false);
  }

  /**
   * The last chance to catch a taken or reserved URL before they answer three
   * more questions. Only a definite "taken" stops them; an inconclusive check
   * falls through to the transaction, which is authoritative anyway.
   */
  async function confirmStoreUrl() {
    const cached = slugCheck && slugCheck.slug === draft.storeSlug && slugCheck.state !== "checking" ? slugCheck : null;
    const outcome = cached ?? (await fetchSlugAvailability(draft.storeSlug));

    setSlugCheck(outcome);

    if (outcome.state === "taken") {
      setError(outcome.message ?? "Pick a different store URL.");
      return;
    }

    setNotice(null);
    setStep((current) => current + 1);
  }

  /**
   * The store is created here, while the seller is still on the registration
   * form, so they land on a working dashboard rather than a second setup wizard
   * asking again for the name and URL they just typed.
   *
   * On failure they stay on this step. The account exists and the session is
   * live by then, but sending them to the dashboard would only reopen that
   * wizard, and Back still works if the URL is the thing to fix.
   */
  async function createWorkspace() {
    let response: Response | null = null;

    try {
      response = await fetch("/api/onboarding", {
        body: JSON.stringify({ businessType: draft.businessType, country: draft.country, currency: draft.currency, organizationName: draft.storeName, storeName: draft.storeName, storeSlug: draft.storeSlug, timezone: draft.timezone }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
    } catch {
      // Seeding a demo catalog is not a fast request, and a connection that
      // drops on the way back says nothing about whether it committed.
    }

    if (response?.ok || (await hasWorkspace())) {
      sessionStorage.removeItem("dash-store-setup-draft");
      return true;
    }

    const body = response ? ((await response.json().catch(() => null)) as ErrorBody | null) : null;
    // Kept for the dashboard's fallback wizard in case they navigate away
    // instead of retrying here: it then opens prefilled rather than empty.
    sessionStorage.setItem("dash-store-setup-draft", JSON.stringify({ businessType: draft.businessType, country: draft.country, storeName: draft.storeName, storeSlug: draft.storeSlug }));
    setError(body?.error ?? "We could not reach the server to create your store. Check your connection and try again.");

    return false;
  }

  async function finish() {
    const destination = inviteToken ? `/invite/${encodeURIComponent(inviteToken)}` : "/dashboard";
    const result = await signIn("credentials", { identifier: draft.identifier, password: draft.password, redirect: false, callbackUrl: destination });

    if (!result?.ok) { router.push(`/login?callbackUrl=${encodeURIComponent(destination)}`); return; }
    // An invited member joins a store that already exists; only an owner has one to create.
    if (!inviteToken && !(await createWorkspace())) { return; }

    setSuccess(true);
    router.push(result.url ?? destination); router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validation = validateCurrentStep();

    if (validation) {
      setError(validation);
      return;
    }

    setIsSubmitting(true);

    try {
      if (step === 1) {
        await startVerification();
        return;
      }

      if (step === verifyStep) {
        await submitCode();
        return;
      }

      if (step === storeStep && !inviteToken) {
        await confirmStoreUrl();
        return;
      }

      if (step < lastStep) {
        setNotice(null);
        setStep((current) => current + 1);
        return;
      }

      await finish();
    } catch {
      // Nothing below this may fail silently: an unhandled rejection here used
      // to leave the seller on a finished-looking form that simply did nothing.
      setError("Something went wrong. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function goBack() {
    setStep((current) => current - 1);
    setError(null);
    setNotice(null);
  }

  const submitLabel = isSubmitting ? <><LoaderCircle className={usesWizard ? ob.spinner : styles.spinner} /> {submittingLabel(step, lastStep, Boolean(inviteToken))}</> : success ? <><Check /> {inviteToken ? "Signed in" : "Workspace ready"}</> : step === verifyStep ? <>Verify <ArrowRight /></> : step === lastStep ? <>{inviteToken ? "Join the team" : "Generate my store"} {inviteToken ? <ArrowRight /> : <Sparkles />}</> : <>Continue <ArrowRight /></>;

  if (usesWizard) {
    return (
      <main className={ob.onboardingPage}>
        <header className={ob.topbar}>
          <Link className={ob.brand} href="/"><b>S</b> Store<i>IM</i></Link>
          <div><span>{draft.identifier}</span></div>
        </header>
        <section className={ob.onboardingShell} aria-labelledby="register-wizard-title">
          <div className={ob.pageIntro}><span>Workspace setup</span><h1 id="register-wizard-title">Let’s build your commerce workspace.</h1><p>Your account is verified. A few more answers and your store is ready — storefront, products, payments, and shipping all prepared for you.</p></div>
          <div className={ob.flowLayout}>
            <section className={ob.formCard}>
              <header className={ob.progressHeader}><div><span>Step {step} of {lastStep}</span><b>{stepLabels[step - 1]}</b></div><div className={ob.progressTrack}><i style={{ width: `${Math.round((step / lastStep) * 100)}%` }} /></div></header>
              <form className={ob.stepForm} noValidate onSubmit={handleSubmit}>
                <div className={ob.stepBody}>
                  {step === storeStep ? <WizardStoreStep draft={draft} platformDomain={platformDomain} previewDomain={previewDomain} slugCheck={slugCheck} update={update} /> : null}
                  {step === businessStep ? <WizardBusinessStep onChange={selectBusinessType} value={draft.businessType} /> : null}
                  {step === regionStep ? <WizardRegionStep draft={draft} onCountryChange={selectCountry} onCurrencyChange={(value) => { setDraft((current) => ({ ...current, currency: value })); setError(null); }} onTimezoneChange={(value) => { setDraft((current) => ({ ...current, timezone: value })); setError(null); }} /> : null}
                  {step === lastStep ? <WizardFinishStep draft={draft} previewDomain={previewDomain} success={success} /> : null}
                </div>
                {error ? <p className={ob.errorMessage}>{error}</p> : null}
                <footer className={ob.stepActions}>{step > firstBackStep && !success ? <button className={ob.backButton} disabled={isSubmitting} onClick={goBack} type="button"><ArrowLeft /> Back</button> : <span />}<button className={ob.nextButton} disabled={isSubmitting || success} type="submit">{submitLabel}</button></footer>
              </form>
              {isSubmitting && step === lastStep ? <div className={ob.loadingOverlay} role="status"><span><LoaderCircle /></span><h3>Generating your workspace...</h3><p>Preparing your store, domain, payments, shipping, and settings.</p></div> : null}
            </section>
            <StorePreview country={draft.country} currency={draft.currency} domain={previewDomain} name={draft.storeName} />
          </div>
        </section>
      </main>
    );
  }

  return (
    <AuthExperience description="Create your account, shape your store identity, and step into a calmer way to run commerce." eyebrow="Start building" title="Your next stage starts here.">
      <div className={styles.formStack}>
        <div className={styles.progress} aria-label={`Registration step ${step} of ${lastStep}`} style={{ "--steps": lastStep } as CSSProperties}>{stepLabels.map((label, index) => <span className={index + 1 <= step ? styles.progressActive : ""} key={label}><i>{index + 1 < step ? <Check /> : index + 1}</i><b>{label}</b></span>)}</div>
        {step === 1 ? <><GoogleAuthButton callbackUrl={inviteToken ? `/invite/${encodeURIComponent(inviteToken)}` : "/dashboard"} /><div className={styles.divider}><span>or create with email or phone</span></div></> : null}
        <form className={styles.authForm} noValidate onSubmit={handleSubmit}>
          {step === 1 ? <AccountStep draft={draft} showPassword={showPassword} togglePassword={() => setShowPassword((value) => !value)} update={update} /> : null}
          {step === verifyStep ? <VerifyStep challenge={challenge} code={code} isResending={isResending} onCodeChange={(value) => { setCode(value); setError(null); }} onResend={resendCode} secondsLeft={secondsLeft} /> : null}
          {step === lastStep ? <InviteFinishStep draft={draft} success={success} /> : null}
          {notice ? <p className={styles.successMessage}>{notice}</p> : null}
          {error ? <p className={styles.errorMessage}>{error}</p> : null}
          <div className={styles.stepActions}>{step > firstBackStep && !success ? <button className={styles.backButton} onClick={goBack} type="button"><ArrowLeft /> Back</button> : null}<button className={styles.submitButton} disabled={isSubmitting || success || (step === verifyStep && code.length < codeLength)} type="submit">{submitLabel}</button></div>
        </form>
        <p className={styles.switchPrompt}>Already have an account? <Link href="/login">Log in</Link></p>
      </div>
    </AuthExperience>
  );
}

function submittingLabel(step: number, lastStep: number, isInvite: boolean) {
  if (step === 1) return "Sending code...";
  if (step === verifyStep) return "Checking...";
  // Tested before storeStep: on an invite there is no store step, and step 3 is the last one.
  if (step === lastStep) return isInvite ? "Signing you in..." : "Generating your store...";
  if (step === storeStep) return "Checking URL...";
  return "Continuing...";
}

function AccountStep({ draft, showPassword, togglePassword, update }: { draft: Draft; showPassword: boolean; togglePassword: () => void; update: (field: DraftText, value: string) => void }) { return <><label>Full name<div className={styles.inputShell}><UserRound /><input autoComplete="name" onChange={(event) => update("name", event.target.value)} placeholder="Your full name" type="text" value={draft.name} /></div></label><label>Email or phone<div className={styles.inputShell}><UserRound /><input autoComplete="username" onChange={(event) => update("identifier", event.target.value)} placeholder="you@company.com or 01XXXXXXXXX" type="text" value={draft.identifier} /></div></label><label>Password<div className={styles.inputShell}><LockKeyhole /><input autoComplete="new-password" onChange={(event) => update("password", event.target.value)} placeholder="At least 8 characters" type={showPassword ? "text" : "password"} value={draft.password} /><button aria-label={showPassword ? "Hide password" : "Show password"} onClick={togglePassword} type="button">{showPassword ? <EyeOff /> : <Eye />}</button></div></label></>; }

function VerifyStep({ challenge, code, isResending, onCodeChange, onResend, secondsLeft }: { challenge: Challenge | null; code: string; isResending: boolean; onCodeChange: (value: string) => void; onResend: () => void; secondsLeft: number }) {
  const sentBy = challenge?.channel === "SMS" ? "text message" : "email";

  return (
    <>
      <div className={styles.stepHeading}><span><MessageSquare /></span><div><h2>Confirm it is you</h2><p>Codes expire after a few minutes. Use Back to correct your address or number.</p></div></div>
      <p className={styles.sentTo}>We sent a {codeLength}-digit code by {sentBy} to<br /><b>{challenge?.identifier ?? "your account"}</b></p>
      <CodeInput onChange={onCodeChange} value={code} />
      <div className={styles.resendRow}>{secondsLeft > 0 ? <span>You can ask for another code in {secondsLeft}s</span> : <><span>Did not get it?</span><button disabled={isResending} onClick={onResend} type="button">{isResending ? "Sending..." : "Send another code"}</button></>}</div>
      {challenge?.devCode ? <p className={styles.successMessage}>Development build: nothing is configured to send messages, so the code is <b>{challenge.devCode}</b>. It is in the server log too.</p> : null}
    </>
  );
}

/** The narrow layout's only ending: an owner is on the wizard by this point. */
function InviteFinishStep({ draft, success }: { draft: Draft; success: boolean }) {
  return <div className={styles.finishState}><span className={styles.finishIcon}>{success ? <Check /> : <UserRound />}</span><h2>{success ? "You are signed in." : "Your account is verified."}</h2><p>{success ? "Taking you back to your invite..." : "Continue, and we will take you straight back to the invite to join the team."}</p><div><span><small>Name</small><b>{draft.name}</b></span><span><small>Account</small><b>{draft.identifier}</b></span></div></div>;
}

function WizardStoreStep({ draft, platformDomain, previewDomain, slugCheck, update }: { draft: Draft; platformDomain: string; previewDomain: string; slugCheck: SlugCheck | null; update: (field: DraftText, value: string) => void }) {
  // A verdict on a slug they have since edited says nothing about the one on screen.
  const status = slugCheck && slugCheck.slug === draft.storeSlug ? slugCheck : null;

  return (
    <StepIntro eyebrow="Your store identity" icon={Store} text="Choose the customer-facing name for your brand, and the address your customers will visit." title="What should we call your store?">
      <label className={ob.fieldLabel}>Store Name<div className={ob.inputShell}><Store /><input autoFocus maxLength={100} onChange={(event) => update("storeName", event.target.value)} placeholder="Akash Atelier" value={draft.storeName} /></div><small>You can update this later from store settings.</small></label>
      <label className={ob.fieldLabel}>Store URL<div className={ob.slugInput}><span>https://</span><input aria-label="Store URL slug" maxLength={40} onChange={(event) => update("storeSlug", slugify(event.target.value))} placeholder="yourstore" value={draft.storeSlug} /><b>.{platformDomain}</b></div><small>Preview: {previewDomain}</small></label>
      {status ? <SlugStatusLine status={status} theme={{ available: ob.slugAvailable, base: ob.slugStatus, spinner: ob.spinner, taken: ob.slugTaken }} /> : null}
    </StepIntro>
  );
}

function WizardBusinessStep({ onChange, value }: { onChange: (value: BusinessType) => void; value: BusinessType }) {
  return (
    <StepIntro eyebrow="Tailor your workspace" icon={BriefcaseBusiness} text="This picks your storefront template and the starter catalog we prepare for you." title="What kind of business are you building?">
      <div className={ob.optionGrid}>{businessTypes.map((type) => <button className={value === type ? ob.optionActive : ""} key={type} onClick={() => onChange(type)} type="button"><span>{type.charAt(0)}</span><b>{type}</b>{value === type ? <Check /> : null}</button>)}</div>
    </StepIntro>
  );
}

function WizardRegionStep({ draft, onCountryChange, onCurrencyChange, onTimezoneChange }: { draft: Draft; onCountryChange: (value: CountryName) => void; onCurrencyChange: (value: string) => void; onTimezoneChange: (value: string) => void }) {
  return (
    <StepIntro eyebrow="Localize your store" icon={MapPin} text="Currency and timezone follow your country. Change either one if you need to." title="Where is your business based?">
      <label className={ob.fieldLabel}>Country<select autoFocus onChange={(event) => onCountryChange(event.target.value as CountryName)} value={draft.country}>{Object.keys(countryOptions).map((name) => <option key={name}>{name}</option>)}</select></label>
      <div className={ob.fieldRow}>
        <label className={ob.fieldLabel}>Currency<select onChange={(event) => onCurrencyChange(event.target.value)} value={draft.currency}>{currencyOptions.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
        <label className={ob.fieldLabel}>Timezone<select onChange={(event) => onTimezoneChange(event.target.value)} value={draft.timezone}>{timezoneOptions.map((timezone) => <option key={timezone}>{timezone}</option>)}</select></label>
      </div>
    </StepIntro>
  );
}

function WizardFinishStep({ draft, previewDomain, success }: { draft: Draft; previewDomain: string; success: boolean }) {
  return (
    <StepIntro eyebrow="Ready to launch" icon={Sparkles} text={success ? "Taking you to your dashboard..." : "Review the essentials. StoreIM will prepare the rest automatically."} title={success ? "Your workspace is ready." : "Your workspace is ready to be generated."}>
      <div className={ob.reviewList}>
        <WizardReview label="Account" value={draft.identifier} />
        <WizardReview label="Store" value={draft.storeName} />
        <WizardReview label="Domain" value={previewDomain} />
        <WizardReview label="Business" value={draft.businessType} />
        <WizardReview label="Location" value={`${draft.country} · ${draft.currency} · ${draft.timezone}`} />
      </div>
      <p className={ob.creationNote}><Check /> Default payments, shipping zones, theme settings, and StoreOS connection will be prepared.</p>
    </StepIntro>
  );
}

function WizardReview({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><b>{value}</b></div>; }

function SlugStatusLine({ status, theme }: { status: SlugCheck; theme: SlugTheme }) {
  const tone = status.state === "available" ? theme.available : status.state === "taken" ? theme.taken : undefined;

  return (
    <p className={[theme.base, tone].filter(Boolean).join(" ")} role="status">
      {status.state === "checking" ? <><LoaderCircle className={theme.spinner} /> Checking availability...</> : status.state === "available" ? <><Check /> That URL is available.</> : status.state === "taken" ? <><CircleAlert /> {status.message}</> : <>We could not check this URL just now. It will be confirmed when your store is created.</>}
    </p>
  );
}
