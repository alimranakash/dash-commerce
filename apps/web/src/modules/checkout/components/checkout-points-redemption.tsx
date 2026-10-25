"use client";

import { useEffect, useState, type RefObject } from "react";
import type { RedemptionLimits, RedemptionPolicy } from "../../loyalty/loyalty.rules";

export type VerifiedPoints = {
  balance: number;
  /** The number the code went to; the quote and the order must name the same one. */
  phone: string;
  token: string;
};

/**
 * Spending loyalty points at checkout.
 *
 * Nothing about the member is shown until the shopper proves the number is
 * theirs: a code goes to the number typed above, and only once it checks out
 * does the balance appear. The number is read out of the form, as the COD
 * check does, and editing it afterwards drops the verification — a token
 * proves one number, and the order refuses it for any other.
 *
 * What is posted is a count of points and the token, never a discount. The
 * limits shown here are the server's, from `/api/checkout/loyalty-quote`, which
 * prices this basket the way the order will; the order still works them out
 * again against the balance it reads inside its own transaction.
 */
export function CheckoutPointsRedemption({
  appliedPoints,
  balance,
  currency,
  formRef,
  limits,
  onChoose,
  onRemove,
  onVerified,
  policy,
  programName,
  quoteMessage,
  quoting,
  storeSlug,
  verified
}: {
  appliedPoints: number;
  balance: number | null;
  currency: string;
  formRef: RefObject<HTMLFormElement | null>;
  limits: RedemptionLimits | null;
  onChoose: (points: number) => void;
  onRemove: () => void;
  onVerified: (verified: VerifiedPoints) => void;
  policy: RedemptionPolicy;
  programName: string;
  quoteMessage: string | null;
  quoting: boolean;
  storeSlug: string;
  verified: VerifiedPoints | null;
}) {
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // A verification proves one number. Typing a different one above withdraws it.
  useEffect(() => {
    const form = formRef.current;

    if (!form || !verified) {
      return;
    }

    const onInput = (event: Event) => {
      if ((event.target as HTMLInputElement | null)?.name === "phone") {
        onRemove();
        setSentTo(null);
        setCode("");
      }
    };

    form.addEventListener("input", onInput);

    return () => form.removeEventListener("input", onInput);
  }, [formRef, onRemove, verified]);

  function readField(name: string) {
    return formRef.current ? String(new FormData(formRef.current).get(name) ?? "").trim() : "";
  }

  function readPhone() {
    return readField("phone");
  }

  async function sendCode() {
    const phone = readPhone();

    if (!phone) {
      setMessage("Enter your mobile number above first.");
      return;
    }

    setBusy(true);
    setMessage(null);

    const response = await fetch("/api/checkout/loyalty-code", {
      body: JSON.stringify({ phone, storeSlug }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    const body = (await response.json().catch(() => null)) as {
      devCode?: string;
      error?: string;
      identifier?: string;
    } | null;

    if (response.ok && body?.identifier) {
      setSentTo(body.identifier);
      setDevCode(body.devCode ?? null);
    } else {
      setMessage(body?.error ?? "We could not send a code. Check the number and try again.");
    }

    setBusy(false);
  }

  async function checkCode() {
    setBusy(true);
    setMessage(null);

    const phone = readPhone();
    // The page load's own submission id: the token will pay for this order only.
    const response = await fetch("/api/checkout/loyalty-verify", {
      body: JSON.stringify({ code, phone, storeSlug, submissionId: readField("submissionId") }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    const body = (await response.json().catch(() => null)) as {
      balance?: number;
      error?: string;
      token?: string;
    } | null;

    if (response.ok && typeof body?.balance === "number" && body.token) {
      onVerified({ balance: body.balance, phone, token: body.token });
      setDevCode(null);
    } else {
      setMessage(body?.error ?? "That code did not work.");
    }

    setBusy(false);
  }

  const posting = verified && limits?.available && appliedPoints >= limits.minPoints;

  return (
    <fieldset>
      <legend>Use your {programName} points</legend>
      {/* Posted only while the choice is valid; otherwise the order carries no points at all. */}
      <input name="loyaltyPoints" type="hidden" value={posting ? String(appliedPoints) : ""} />
      <input name="loyaltyToken" type="hidden" value={posting && verified ? verified.token : ""} />
      {verified && !limits ? (
        <>
          <p className="sf-checkout-hint">
            {quoting
              ? "Checking how many points this order can take…"
              : (quoteMessage ?? "Checking your points…")}
          </p>
          <button onClick={onRemove} type="button">
            Don&apos;t use points
          </button>
        </>
      ) : verified && limits ? (
        <>
          <p className="sf-checkout-hint">
            You have {(balance ?? verified.balance).toLocaleString("en")} points.{" "}
            {limits.available
              ? `This order can use ${limits.minPoints.toLocaleString("en")} to ${limits.maxPoints.toLocaleString("en")} of them; each is worth ${formatMoney(limits.pointValueCents / 100, currency)}.`
              : limits.maxPoints > 0
                ? `This order can take at most ${limits.maxPoints.toLocaleString("en")}, below the ${limits.minPoints.toLocaleString("en")}-point minimum.`
                : `You need at least ${policy.minRedeemPoints.toLocaleString("en")} points to use them.`}
          </p>
          {limits.available ? (
            <label>
              Points to use
              <input
                inputMode="numeric"
                max={limits.maxPoints}
                min={limits.minPoints}
                onChange={(event) => onChoose(Math.floor(Number(event.target.value) || 0))}
                step={1}
                type="number"
                value={appliedPoints}
              />
            </label>
          ) : null}
          {limits.available && appliedPoints < limits.minPoints ? (
            <p className="sf-alert">
              Use at least {limits.minPoints.toLocaleString("en")} points, or none — no points will
              be used as it stands.
            </p>
          ) : null}
          <button onClick={onRemove} type="button">
            Don&apos;t use points
          </button>
        </>
      ) : (
        <>
          <p className="sf-checkout-hint">
            {sentTo
              ? `If ${sentTo} has points here, we'll text it a 6-digit code.`
              : `Points can cover up to ${policy.maxRedeemPercent}% of your products, never delivery. Confirm your number to see yours.`}
          </p>
          <button disabled={busy} onClick={sendCode} type="button">
            {busy && !sentTo ? "Sending..." : sentTo ? "Send another code" : "Send code"}
          </button>
          {sentTo ? (
            <>
              <label>
                Code
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="6-digit code"
                  type="text"
                  value={code}
                />
              </label>
              <button disabled={busy || code.trim().length === 0} onClick={checkCode} type="button">
                {busy ? "Checking..." : "Show my points"}
              </button>
            </>
          ) : null}
        </>
      )}
      {devCode ? (
        <p className="sf-checkout-hint">Development build: the code is {devCode}.</p>
      ) : null}
      {message ? <p className="sf-alert">{message}</p> : null}
    </fieldset>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(value);
}
