"use client";

import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Store, UserRound } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./auth-experience.module.css";
import { GoogleAuthButton } from "./google-auth-button";

type Draft = { email: string; name: string; password: string; storeName: string; storeSlug: string };
const initialDraft: Draft = { email: "", name: "", password: "", storeName: "", storeSlug: "" };

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  /**
   * Set when the visitor arrived from an invite link. Someone joining an
   * existing team must not be walked through naming a store — they are not
   * creating one — so the store step is dropped and they are handed back to the
   * invite once the account exists.
   */
  const inviteToken = searchParams?.get("invite") ?? null;
  const stepLabels = inviteToken ? ["Account", "Finish"] : ["Account", "Store", "Finish"];
  const lastStep = stepLabels.length;
  const [draft, setDraft] = useState(initialDraft);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function update(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value, ...(field === "storeName" ? { storeSlug: slugify(value) } : {}) }));
    setError(null);
  }

  function validateCurrentStep() {
    if (step === 1) {
      if (draft.name.trim().length < 2) return "Enter your full name.";
      if (!/^\S+@\S+\.\S+$/.test(draft.email)) return "Enter a valid email address.";
      if (draft.password.length < 8) return "Password must be at least 8 characters.";
    }
    if (step === 2 && !inviteToken) {
      if (draft.storeName.trim().length < 2) return "Enter your store name.";
      if (!/^[a-z0-9-]{3,40}$/.test(draft.storeSlug)) return "Store URL must use 3–40 lowercase letters, numbers, or hyphens.";
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    if (step < lastStep) { const validation = validateCurrentStep(); if (validation) { setError(validation); return; } setStep((current) => current + 1); return; }
    setIsSubmitting(true);
    const destination = inviteToken ? `/invite/${encodeURIComponent(inviteToken)}` : "/dashboard";
    const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: draft.name, email: draft.email, password: draft.password }) });
    if (!response.ok) { const body = (await response.json().catch(() => null)) as { error?: string } | null; setError(body?.error ?? "Registration failed."); setIsSubmitting(false); return; }
    setSuccess(true);
    const result = await signIn("credentials", { email: draft.email, password: draft.password, redirect: false, callbackUrl: destination });
    if (!result?.ok) { router.push(`/login?callbackUrl=${encodeURIComponent(destination)}`); return; }
    // Only a store owner has a draft to carry into onboarding; an invited member
    // would otherwise land on the dashboard with a half-filled store form.
    if (!inviteToken) { sessionStorage.setItem("dash-store-setup-draft", JSON.stringify({ storeName: draft.storeName, storeSlug: draft.storeSlug })); }
    router.push(result.url ?? destination); router.refresh();
  }

  return (
    <div className={styles.formStack}>
      <div className={styles.progress} aria-label={`Registration step ${step} of ${lastStep}`}>{stepLabels.map((label, index) => <span className={index + 1 <= step ? styles.progressActive : ""} key={label}><i>{index + 1 < step ? <Check /> : index + 1}</i><b>{label}</b></span>)}</div>
      {step === 1 ? <><GoogleAuthButton callbackUrl={inviteToken ? `/invite/${encodeURIComponent(inviteToken)}` : "/dashboard"} /><div className={styles.divider}><span>or create with email</span></div></> : null}
      <form className={styles.authForm} noValidate onSubmit={handleSubmit}>
        {step === 1 ? <AccountStep draft={draft} showPassword={showPassword} togglePassword={() => setShowPassword((value) => !value)} update={update} /> : null}
        {step === 2 && !inviteToken ? <StoreStep draft={draft} update={update} /> : null}
        {step === lastStep ? <FinishStep draft={draft} isInvite={Boolean(inviteToken)} success={success} /> : null}
        {error ? <p className={styles.errorMessage}>{error}</p> : null}
        <div className={styles.stepActions}>{step > 1 && !success ? <button className={styles.backButton} onClick={() => { setStep((current) => current - 1); setError(null); }} type="button"><ArrowLeft /> Back</button> : null}<button className={styles.submitButton} disabled={isSubmitting || success} type="submit">{isSubmitting ? <><LoaderCircle className={styles.spinner} /> Creating...</> : success ? <><Check /> Account created</> : step === lastStep ? <>{inviteToken ? "Create account" : "Finish Setup"} <ArrowRight /></> : <>Continue <ArrowRight /></>}</button></div>
      </form>
      <p className={styles.switchPrompt}>Already have an account? <Link href="/login">Log in</Link></p>
    </div>
  );
}

function AccountStep({ draft, showPassword, togglePassword, update }: { draft: Draft; showPassword: boolean; togglePassword: () => void; update: (field: keyof Draft, value: string) => void }) { return <><label>Full name<div className={styles.inputShell}><UserRound /><input autoComplete="name" onChange={(event) => update("name", event.target.value)} placeholder="Your full name" type="text" value={draft.name} /></div></label><label>Email address<div className={styles.inputShell}><Mail /><input autoComplete="email" onChange={(event) => update("email", event.target.value)} placeholder="you@company.com" type="email" value={draft.email} /></div></label><label>Password<div className={styles.inputShell}><LockKeyhole /><input autoComplete="new-password" onChange={(event) => update("password", event.target.value)} placeholder="At least 8 characters" type={showPassword ? "text" : "password"} value={draft.password} /><button aria-label={showPassword ? "Hide password" : "Show password"} onClick={togglePassword} type="button">{showPassword ? <EyeOff /> : <Eye />}</button></div></label></>; }
function StoreStep({ draft, update }: { draft: Draft; update: (field: keyof Draft, value: string) => void }) { return <><div className={styles.stepHeading}><span><Store /></span><div><h2>Name your store</h2><p>You can refine your branding and business settings later.</p></div></div><label>Store name<div className={styles.inputShell}><Store /><input onChange={(event) => update("storeName", event.target.value)} placeholder="Akash Atelier" type="text" value={draft.storeName} /></div></label><label>Store URL<div className={styles.urlInput}><input aria-label="Store URL slug" onChange={(event) => update("storeSlug", slugify(event.target.value))} placeholder="yourstore" value={draft.storeSlug} /><span>.dash.com</span></div></label><div className={styles.urlPreview}><small>Your storefront</small><b>{draft.storeSlug || "yourstore"}.dash.com</b></div></>; }
function FinishStep({ draft, isInvite, success }: { draft: Draft; isInvite: boolean; success: boolean }) {
  if (isInvite) {
    return <div className={styles.finishState}><span className={styles.finishIcon}>{success ? <Check /> : <UserRound />}</span><h2>{success ? "Your account is ready." : "Everything looks good."}</h2><p>{success ? "Taking you back to your invite..." : "Create your account, and we will take you straight back to the invite to join the team."}</p><div><span><small>Name</small><b>{draft.name}</b></span><span><small>Email</small><b>{draft.email}</b></span></div></div>;
  }

  return <div className={styles.finishState}><span className={styles.finishIcon}>{success ? <Check /> : <Store />}</span><h2>{success ? "Your account is ready." : "Everything looks good."}</h2><p>{success ? "Taking you to your new commerce workspace..." : "Create your account now, then complete the remaining store details inside Dash."}</p><div><span><small>Account</small><b>{draft.name}</b></span><span><small>Store</small><b>{draft.storeName}</b></span><span><small>URL</small><b>{draft.storeSlug}.dash.com</b></span></div></div>;
}
function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40); }
