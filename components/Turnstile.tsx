"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

/** Vérification anti-robot Cloudflare Turnstile. N'apparaît que si NEXT_PUBLIC_TURNSTILE_SITE_KEY est défini. */
export default function Turnstile({ onToken, resetSignal }: { onToken: (t: string) => void; resetSignal: number }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!siteKey) return;
    const render = () => {
      if (box.current && window.turnstile && !widget.current) {
        widget.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          appearance: "interaction-only",
          callback: (t: string) => onToken(t),
          "expired-callback": () => onToken(""),
        });
      }
    };
    if (window.turnstile) return render();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [siteKey, onToken]);

  useEffect(() => {
    if (resetSignal > 0 && window.turnstile && widget.current) {
      onToken("");
      window.turnstile.reset(widget.current);
    }
  }, [resetSignal, onToken]);

  if (!siteKey) return null;
  return <div ref={box} />;
}
