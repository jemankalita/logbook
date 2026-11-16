"use client";

import { useEffect } from "react";

/** Registers the service worker in production builds (dev skips it so hot reload isn't cached). */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err: unknown) => {
      console.warn("Service worker registration failed", err);
    });
  }, []);
  return null;
}
