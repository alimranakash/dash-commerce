"use client";

import { LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./auth-experience.module.css";

const oauthErrors: Record<string, string> = {
  AccessDenied: "Google did not authorize this sign-in. Please choose a verified Google account.",
  Configuration: "Google sign-in is temporarily unavailable. Please contact support.",
  OAuthAccountNotLinked: "This email is already associated with another sign-in method. Try logging in with your password first.",
  OAuthCallback: "Google could not complete the sign-in callback. Please try again.",
  OAuthCreateAccount: "Your Google account could not be created. Please try again.",
  OAuthSignin: "Google sign-in could not be started. Please try again."
};

export function GoogleAuthButton({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const oauthError = useMemo(() => {
    const error = searchParams?.get("error");
    return error ? oauthErrors[error] ?? "Google sign-in failed. Please try again." : null;
  }, [searchParams]);

  // Backing out of Google's account chooser restores this page from the mobile
  // browser's back/forward cache with its React state intact, so the button comes
  // back disabled and still reading "Connecting to Google...", leaving no way to
  // retry short of a reload. `pageshow` is the only event fired on that restore;
  // an ordinary load reports `persisted: false` and is left alone.
  useEffect(() => {
    function resetOnRestoreFromCache(event: PageTransitionEvent) {
      if (event.persisted) {
        setIsLoading(false);
      }
    }

    window.addEventListener("pageshow", resetOnRestoreFromCache);

    return () => window.removeEventListener("pageshow", resetOnRestoreFromCache);
  }, []);

  async function startGoogleSignIn() {
    setLocalError(null);
    setIsLoading(true);
    try {
      await signIn("google", {
        callbackUrl: searchParams?.get("callbackUrl") ?? callbackUrl
      });
    } catch {
      setLocalError("Google sign-in could not be started. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <>
      <button className={styles.googleButton} disabled={isLoading} onClick={startGoogleSignIn} type="button">
        {isLoading ? <LoaderCircle className={styles.spinner} /> : <span>G</span>}
        {isLoading ? "Connecting to Google..." : "Continue with Google"}
      </button>
      {localError || oauthError ? <p className={styles.errorMessage}>{localError ?? oauthError}</p> : null}
    </>
  );
}
