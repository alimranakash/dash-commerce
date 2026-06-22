"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

export function ParallaxStage({ children, className, id }: { children: ReactNode; className?: string | undefined; id?: string | undefined }) {
  const stageRef = useRef<HTMLDivElement>(null);

  function move(event: PointerEvent<HTMLDivElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    event.currentTarget.style.setProperty("--parallax-x", x.toFixed(3));
    event.currentTarget.style.setProperty("--parallax-y", y.toFixed(3));
  }

  function reset() {
    stageRef.current?.style.setProperty("--parallax-x", "0");
    stageRef.current?.style.setProperty("--parallax-y", "0");
  }

  return <div className={className} id={id} onPointerLeave={reset} onPointerMove={move} ref={stageRef}>{children}</div>;
}

export function TypingText({ text }: { text: string }) {
  const [visible, setVisible] = useState("");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(text);
      return;
    }
    const characters = Array.from(text);
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisible(characters.slice(0, index).join(""));
      if (index >= characters.length) window.clearInterval(timer);
    }, 34);
    return () => window.clearInterval(timer);
  }, [text]);

  return <>{visible}<span aria-hidden="true">|</span></>;
}
