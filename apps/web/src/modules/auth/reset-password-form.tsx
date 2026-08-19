"use client";

import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import styles from "./auth-experience.module.css";
import { CodeInput, codeLength } from "./code-input";
import { parseAccountIdentifier } from "./identifier";

type Challenge = { channel: "EMAIL" | "SMS"; devCode: string | null; identifier: string };
type ErrorBody = { attemptsRemaining?: number; code?: string; error?: string; retryAfterSeconds?: number };
type TicketBody = { channel: "EMAIL" | "SMS"; devCode?: string; identifier: string; resendAvailableAt: string };

export function ResetPasswordForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [done, setDone] = useState(false);
  const secondsLeft = resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (challenge === null || done) {
      return;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [challenge, done]);

  function openChallenge(ticket: TicketBody, message: string | null) {
    setChallenge({ channel: ticket.channel, devCode: ticket.devCode ?? null, identifier: ticket.identifier });
    setResendAt(new Date(ticket.resendAvailableAt).getTime());
    setNow(Date.now());
    setNotice(message);
    setCode("");
  }

  async function requestCode() {
    const response = await fetch("/api/auth/password-reset/request", {
      body: JSON.stringify({ identifier }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    const body = (await response.json().catch(() => null)) as (ErrorBody & Partial<TicketBody>) | null;

    return { body, ok: response.ok };
  }

  async function startReset() {
    if (!parseAccountIdentifier(identifier)) {
      setError("Enter a valid email address or Bangladesh mobile number.");
      return;
    }

    const { body, ok } = await requestCode();

    if (ok && body?.channel && body.identifier && body.resendAvailableAt) {
      openChallenge(body as TicketBody, null);
      return;
    }

    if (body?.code === "COOLDOWN") {
      const parsed = parseAccountIdentifier(identifier);

      openChallenge(
        {
          channel: parsed?.channel ?? "EMAIL",
          identifier: parsed === null ? identifier : parsed.channel === "EMAIL" ? parsed.email : parsed.phone,
          resendAvailableAt: new Date(Date.now() + (body.retryAfterSeconds ?? 60) * 1000).toISOString()
        },
        "A code was already sent. Enter it below, or wait to send another."
      );
      return;
    }

    setError(body?.error ?? "We could not send a code. Try again.");
  }

  async function submitNewPassword() {
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Those passwords do not match.");
      return;
    }

    const response = await fetch("/api/auth/password-reset/confirm", {
      body: JSON.stringify({ code, identifier, password }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });

    if (response.ok) {
      setDone(true);
      setNotice(null);
      return;
    }

    const body = (await response.json().catch(() => null)) as ErrorBody | null;
    setCode("");

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (challenge === null) {
        await startReset();
        return;
      }

      await submitNewPassword();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className={styles.formStack}>
        <div className={styles.finishState}>
          <span className={styles.finishIcon}><Check /></span>
          <h2>Your password is updated.</h2>
          <p>Sign in with your new password. Any code we sent you no longer works.</p>
        </div>
        <div className={styles.stepActions}>
          <button className={styles.submitButton} onClick={() => router.push("/login")} type="button">Go to log in <ArrowRight /></button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formStack}>
      <form className={styles.authForm} noValidate onSubmit={handleSubmit}>
        {challenge === null ? (
          <>
            <label>Email or phone<div className={styles.inputShell}><UserRound /><input autoComplete="username" onChange={(event) => { setIdentifier(event.target.value); setError(null); }} placeholder="you@company.com or 01XXXXXXXXX" type="text" value={identifier} /></div></label>
            <p className={styles.sentTo}>We will send a {codeLength}-digit code to whichever you use to sign in.</p>
          </>
        ) : (
          <>
            <p className={styles.sentTo}>If that account exists, a code is on its way by {challenge.channel === "SMS" ? "text message" : "email"} to<br /><b>{challenge.identifier}</b></p>
            <CodeInput onChange={(value) => { setCode(value); setError(null); }} value={code} />
            <div className={styles.resendRow}>{secondsLeft > 0 ? <span>You can ask for another code in {secondsLeft}s</span> : <><span>Did not get it?</span><button disabled={isResending} onClick={resendCode} type="button">{isResending ? "Sending..." : "Send another code"}</button></>}</div>
            <label>New password<div className={styles.inputShell}><LockKeyhole /><input autoComplete="new-password" onChange={(event) => { setPassword(event.target.value); setError(null); }} placeholder="At least 8 characters" type={showPassword ? "text" : "password"} value={password} /><button aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
            <label>Confirm new password<div className={styles.inputShell}><LockKeyhole /><input autoComplete="new-password" onChange={(event) => { setConfirmPassword(event.target.value); setError(null); }} placeholder="Type it again" type={showPassword ? "text" : "password"} value={confirmPassword} /></div></label>
            {challenge.devCode ? <p className={styles.successMessage}>Development build: nothing is configured to send messages, so the code is <b>{challenge.devCode}</b>.</p> : null}
          </>
        )}
        {notice ? <p className={styles.successMessage}>{notice}</p> : null}
        {error ? <p className={styles.errorMessage}>{error}</p> : null}
        <div className={styles.stepActions}>
          {challenge === null ? null : <button className={styles.backButton} onClick={() => { setChallenge(null); setCode(""); setError(null); setNotice(null); }} type="button"><ArrowLeft /> Back</button>}
          <button className={styles.submitButton} disabled={isSubmitting || (challenge !== null && code.length < codeLength)} type="submit">
            {isSubmitting ? <><LoaderCircle className={styles.spinner} /> {challenge === null ? "Sending code..." : "Updating..."}</> : challenge === null ? <>Send code <ArrowRight /></> : <>Set new password <ArrowRight /></>}
          </button>
        </div>
      </form>
      <p className={styles.switchPrompt}>Remembered it? <Link href="/login">Log in</Link></p>
    </div>
  );
}
