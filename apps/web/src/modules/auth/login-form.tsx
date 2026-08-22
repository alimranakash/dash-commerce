"use client";

import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./auth-experience.module.css";
import { GoogleAuthButton } from "./google-auth-button";
import { parseAccountIdentifier } from "./identifier";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null); setNotice(null); setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const identifier = String(formData.get("identifier") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (!parseAccountIdentifier(identifier) || !password) { setError("Enter your email address or phone number, and your password."); setIsSubmitting(false); return; }

    const result = await signIn("credentials", { identifier, password, redirect: false, callbackUrl: searchParams?.get("callbackUrl") ?? "/dashboard" });
    if (!result?.ok) { setError("Those details did not match an account."); setIsSubmitting(false); return; }
    setNotice("Login successful. Opening your dashboard...");
    router.push(result.url ?? "/dashboard"); router.refresh();
  }

  return (
    <div className={styles.formStack}>
      <GoogleAuthButton />
      <div className={styles.divider}><span>or continue with email or phone</span></div>
      <form className={styles.authForm} noValidate onSubmit={handleSubmit}>
        <label>Email or phone<div className={styles.inputShell}><UserRound /><input autoComplete="username" name="identifier" placeholder="you@company.com or 01XXXXXXXXX" required type="text" /></div></label>
        <label>Password<div className={styles.inputShell}><LockKeyhole /><input autoComplete="current-password" name="password" placeholder="Enter your password" required type={showPassword ? "text" : "password"} /><button aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
        <div className={styles.formUtility}><label><input type="checkbox" /> Remember me</label><Link href="/reset-password">Forgot password?</Link></div>
        {error ? <p className={styles.errorMessage}>{error}</p> : null}{notice ? <p className={styles.successMessage}>{notice}</p> : null}
        <button className={styles.submitButton} disabled={isSubmitting} type="submit">{isSubmitting ? <><LoaderCircle className={styles.spinner} /> Logging in...</> : <>Log In <ArrowRight /></>}</button>
      </form>
      <p className={styles.switchPrompt}>New to StoreIM? <Link href="/register">Create an account</Link></p>
    </div>
  );
}
