"use client";

import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./auth-experience.module.css";
import { GoogleAuthButton } from "./google-auth-button";

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
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email) || !password) { setError("Enter a valid email and password."); setIsSubmitting(false); return; }

    const result = await signIn("credentials", { email, password, redirect: false, callbackUrl: searchParams.get("callbackUrl") ?? "/dashboard" });
    if (!result?.ok) { setError("Invalid email or password."); setIsSubmitting(false); return; }
    setNotice("Login successful. Opening your dashboard...");
    router.push(result.url ?? "/dashboard"); router.refresh();
  }

  return (
    <div className={styles.formStack}>
      <GoogleAuthButton />
      <div className={styles.divider}><span>or continue with email</span></div>
      <form className={styles.authForm} noValidate onSubmit={handleSubmit}>
        <label>Email address<div className={styles.inputShell}><Mail /><input autoComplete="email" name="email" placeholder="you@company.com" required type="email" /></div></label>
        <label>Password<div className={styles.inputShell}><LockKeyhole /><input autoComplete="current-password" name="password" placeholder="Enter your password" required type={showPassword ? "text" : "password"} /><button aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
        <div className={styles.formUtility}><label><input type="checkbox" /> Remember me</label><button onClick={() => setNotice("Contact support to reset your password.")} type="button">Forgot password?</button></div>
        {error ? <p className={styles.errorMessage}>{error}</p> : null}{notice ? <p className={styles.successMessage}>{notice}</p> : null}
        <button className={styles.submitButton} disabled={isSubmitting} type="submit">{isSubmitting ? <><LoaderCircle className={styles.spinner} /> Logging in...</> : <>Log In <ArrowRight /></>}</button>
      </form>
      <p className={styles.switchPrompt}>New to Dash? <Link href="/register">Create an account</Link></p>
    </div>
  );
}
