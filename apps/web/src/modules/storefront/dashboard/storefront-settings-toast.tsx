"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type StorefrontSettingsToastProps = {
  message?: string | null;
  messageKey?: string | number | null;
  type?: "error" | "info" | "success" | "warning";
};

const TOAST_DURATION = 4200;

function updateToastStack() {
  window.requestAnimationFrame(() => {
    let offset = 0;

    document.querySelectorAll<HTMLElement>("[data-storefront-settings-toast='true']").forEach((toast) => {
      toast.style.setProperty("--toast-offset", `${offset}px`);
      offset += toast.offsetHeight + 12;
    });
  });
}

export function StorefrontSettingsToast({
  message,
  messageKey,
  type = "success"
}: StorefrontSettingsToastProps) {
  const [visible, setVisible] = useState(Boolean(message));
  const remainingRef = useRef(TOAST_DURATION);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = (duration = TOAST_DURATION) => {
    clearTimer();
    remainingRef.current = duration;
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      setVisible(false);
      updateToastStack();
    }, duration);
  };

  useEffect(() => {
    clearTimer();

    if (!message) {
      setVisible(false);
      return;
    }

    setVisible(true);
    startTimer();

    return () => {
      clearTimer();
      updateToastStack();
    };
  }, [message, messageKey]);

  useEffect(() => {
    if (visible) {
      updateToastStack();
    }
  }, [visible]);

  if (!message || !visible) {
    return null;
  }

  const Icon =
    type === "success" ? CheckCircle2 : type === "warning" ? AlertTriangle : type === "info" ? Info : AlertCircle;

  return (
    <div
      className={`storefront-settings-toast is-${type}`}
      data-storefront-settings-toast="true"
      onMouseEnter={() => {
        if (startedAtRef.current) {
          remainingRef.current = Math.max(800, remainingRef.current - (Date.now() - startedAtRef.current));
        }
        clearTimer();
      }}
      onMouseLeave={() => startTimer(remainingRef.current)}
      role={type === "error" ? "alert" : "status"}
    >
      <span className="storefront-settings-toast-icon" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <span className="storefront-settings-toast-message">{message}</span>
      <button
        aria-label="Dismiss notification"
        onClick={() => {
          setVisible(false);
          updateToastStack();
        }}
        type="button"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
