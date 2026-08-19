"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import styles from "./auth-experience.module.css";

export const codeLength = 6;

/**
 * The six boxes every OTP-backed flow shares — sign-up, password reset, and
 * changing the address or number on an account.
 *
 * The whole value is held by the parent as one string rather than six, so
 * "has the visitor finished typing" is `code.length === codeLength` everywhere
 * and no caller has to reassemble it before sending.
 */
export function CodeInput({
  disabled,
  onChange,
  value
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: codeLength }, (_, index) => value[index] ?? "");

  function setDigit(index: number, digit: string) {
    const next = digits.map((current, position) => (position === index ? digit : current));
    // Blanks are stripped rather than kept as spaces, so the length stays an
    // honest count of how many digits have actually been entered.
    onChange(next.join("").replace(/\s/g, ""));

    if (digit && index < codeLength - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      setDigit(index - 1, "");
      inputs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < codeLength - 1) {
      event.preventDefault();
      inputs.current[index + 1]?.focus();
    }
  }

  /**
   * Pasting the whole code out of a message is how most people will fill this
   * in, so it has to spread across the boxes instead of landing in the one that
   * happens to have focus.
   */
  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, codeLength);

    if (!pasted) {
      return;
    }

    event.preventDefault();
    onChange(pasted);
    inputs.current[Math.min(pasted.length, codeLength - 1)]?.focus();
  }

  return (
    <div className={styles.codeInputs}>
      {digits.map((digit, index) => (
        <input
          aria-label={`Digit ${index + 1} of ${codeLength}`}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          disabled={disabled ?? false}
          inputMode="numeric"
          key={index}
          onChange={(event) => setDigit(index, event.target.value.replace(/\D/g, "").slice(-1))}
          onFocus={(event) => event.target.select()}
          onKeyDown={(event) => handleKeyDown(event, index)}
          onPaste={handlePaste}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          value={digit}
        />
      ))}
    </div>
  );
}
