"use client";

import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, MessageSquare, Store, UserRound } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import styles from "./auth-experience.module.css";
import { CodeInput, codeLength } from "./code-input";
import { GoogleAuthButton } from "./google-auth-button";
import { parseAccountIdentifier } from "./identifier";

type Draft = { identifier: string; name: string; password: string; storeName: string; storeSlug: string };
type Challenge = { channel: "EMAIL" | "SMS"; devCode: string | null; identifier: string };
type ErrorBody = { attemptsRemaining?: number; code?: string; error?: string; retryAfterSeconds?: number };
type TicketBody = { channel: "EMAIL" | "SMS"; devCode?: string; identifier: string; resendAvailableAt: string };

const initialDraft: Draft = { identifier: "", name: "", password: "", storeName: "", storeSlug: "" };
const verifyStep = 2;

export function RegisterForm({ platformDomain }: { platformDomain: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  /**
   * Set when the visitor arrived from an invite link. Someone joining an
   * existing team must not be walked through naming a store — they are not
   * creating one — so the store step is dropped and they are handed back to the
   * invite once the account exists.
   */
  const inviteToken = searchParams?.get("invite") ?? null;
  const stepLabels = inviteToken ? ["Account", "Verify", "Finish"] : ["Account", "Verify", "Store", "Finish"];
  const lastStep = stepLabels.length;
  const [draft, setDraft] = useState(initialDraft);
  const [step, setStep] = useState(1);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState("");
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

  useEffect(() => {
    if (step !== verifyStep) {
      return;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [step]);

  function update(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value, ...(field === "storeName" ? { storeSlug: slugify(value) } : {}) }));
    setError(null);
  }

  function validateCurrentStep() {
    if (step === 1) {
      if (draft.name.trim().length < 2) return "Enter your full name.";
      if (!parseAccountIdentifier(draft.identifier)) return "Enter a valid email address or Bangladesh mobile number.";
      if (draft.password.length < 8) return "Password must be at least 8 characters.";
    }
    if (step === verifyStep + 1 && !inviteToken) {
      if (draft.storeName.trim().length < 2) return "Enter your store name.";
      if (!/^[a-z0-9-]{3,40}$/.test(draft.storeSlug)) return "Store URL must use 3–40 lowercase letters, numbers, or hyphens.";
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

  async function finish() {
    const destination = inviteToken ? `/invite/${encodeURIComponent(inviteToken)}` : "/dashboard";
    setSuccess(true);
    const result = await signIn("credentials", { identifier: draft.identifier, password: draft.password, redirect: false, callbackUrl: destination });
    if (!result?.ok) { router.push(`/login?callbackUrl=${encodeURIComponent(destination)}`); return; }
    // Only a store owner has a draft to carry into onboarding; an invited member
    // would otherwise land on the dashboard with a half-filled store form.
    if (!inviteToken) { sessionStorage.setItem("dash-store-setup-draft", JSON.stringify({ storeName: draft.storeName, storeSlug: draft.storeSlug })); }
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

      if (step < lastStep) {
        setNotice(null);
        setStep((current) => current + 1);
        return;
      }

      await finish();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.formStack}>
      <div className={styles.progress} aria-label={`Registration step ${step} of ${lastStep}`} style={{ "--steps": lastStep } as CSSProperties}>{stepLabels.map((label, index) => <span className={index + 1 <= step ? styles.progressActive : ""} key={label}><i>{index + 1 < step ? <Check /> : index + 1}</i><b>{label}</b></span>)}</div>
      {step === 1 ? <><GoogleAuthButton callbackUrl={inviteToken ? `/invite/${encodeURIComponent(inviteToken)}` : "/dashboard"} /><div className={styles.divider}><span>or create with email or phone</span></div></> : null}
      <form className={styles.authForm} noValidate onSubmit={handleSubmit}>
        {step === 1 ? <AccountStep draft={draft} showPassword={showPassword} togglePassword={() => setShowPassword((value) => !value)} update={update} /> : null}
        {step === verifyStep ? <VerifyStep challenge={challenge} code={code} isResending={isResending} onCodeChange={(value) => { setCode(value); setError(null); }} onResend={resendCode} secondsLeft={secondsLeft} /> : null}
        {step === verifyStep + 1 && !inviteToken ? <StoreStep draft={draft} platformDomain={platformDomain} update={update} /> : null}
        {step === lastStep ? <FinishStep draft={draft} isInvite={Boolean(inviteToken)} platformDomain={platformDomain} success={success} /> : null}
        {notice ? <p className={styles.successMessage}>{notice}</p> : null}
        {error ? <p className={styles.errorMessage}>{error}</p> : null}
        <div className={styles.stepActions}>{step > firstBackStep && !success ? <button className={styles.backButton} onClick={() => { setStep((current) => current - 1); setError(null); setNotice(null); }} type="button"><ArrowLeft /> Back</button> : null}<button className={styles.submitButton} disabled={isSubmitting || success || (step === verifyStep && code.length < codeLength)} type="submit">{isSubmitting ? <><LoaderCircle className={styles.spinner} /> {step === 1 ? "Sending code..." : step === verifyStep ? "Checking..." : "Creating..."}</> : success ? <><Check /> Signed in</> : step === verifyStep ? <>Verify <ArrowRight /></> : step === lastStep ? <>{inviteToken ? "Join the team" : "Finish Setup"} <ArrowRight /></> : <>Continue <ArrowRight /></>}</button></div>
      </form>
      <p className={styles.switchPrompt}>Already have an account? <Link href="/login">Log in</Link></p>
    </div>
  );
}

function AccountStep({ draft, showPassword, togglePassword, update }: { draft: Draft; showPassword: boolean; togglePassword: () => void; update: (field: keyof Draft, value: string) => void }) { return <><label>Full name<div className={styles.inputShell}><UserRound /><input autoComplete="name" onChange={(event) => update("name", event.target.value)} placeholder="Your full name" type="text" value={draft.name} /></div></label><label>Email or phone<div className={styles.inputShell}><UserRound /><input autoComplete="username" onChange={(event) => update("identifier", event.target.value)} placeholder="you@company.com or 01XXXXXXXXX" type="text" value={draft.identifier} /></div></label><label>Password<div className={styles.inputShell}><LockKeyhole /><input autoComplete="new-password" onChange={(event) => update("password", event.target.value)} placeholder="At least 8 characters" type={showPassword ? "text" : "password"} value={draft.password} /><button aria-label={showPassword ? "Hide password" : "Show password"} onClick={togglePassword} type="button">{showPassword ? <EyeOff /> : <Eye />}</button></div></label></>; }

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

function StoreStep({ draft, platformDomain, update }: { draft: Draft; platformDomain: string; update: (field: keyof Draft, value: string) => void }) { return <><div className={styles.stepHeading}><span><Store /></span><div><h2>Name your store</h2><p>You can refine your branding and business settings later.</p></div></div><label>Store name<div className={styles.inputShell}><Store /><input onChange={(event) => update("storeName", event.target.value)} placeholder="Akash Atelier" type="text" value={draft.storeName} /></div></label><label>Store URL<div className={styles.urlInput}><input aria-label="Store URL slug" onChange={(event) => update("storeSlug", slugify(event.target.value))} placeholder="yourstore" value={draft.storeSlug} /><span>.{platformDomain}</span></div></label><div className={styles.urlPreview}><small>Your storefront</small><b>{draft.storeSlug || "yourstore"}.{platformDomain}</b></div></>; }

function FinishStep({ draft, isInvite, platformDomain, success }: { draft: Draft; isInvite: boolean; platformDomain: string; success: boolean }) {
  if (isInvite) {
    return <div className={styles.finishState}><span className={styles.finishIcon}>{success ? <Check /> : <UserRound />}</span><h2>{success ? "You are signed in." : "Your account is verified."}</h2><p>{success ? "Taking you back to your invite..." : "Continue, and we will take you straight back to the invite to join the team."}</p><div><span><small>Name</small><b>{draft.name}</b></span><span><small>Account</small><b>{draft.identifier}</b></span></div></div>;
  }

  return <div className={styles.finishState}><span className={styles.finishIcon}>{success ? <Check /> : <Store />}</span><h2>{success ? "You are signed in." : "Your account is verified."}</h2><p>{success ? "Taking you to your new commerce workspace..." : "Finish up now, then complete the remaining store details inside StoreIM."}</p><div><span><small>Account</small><b>{draft.identifier}</b></span><span><small>Store</small><b>{draft.storeName}</b></span><span><small>URL</small><b>{draft.storeSlug}.{platformDomain}</b></span></div></div>;
}

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40); }
