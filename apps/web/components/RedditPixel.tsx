"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    rdt?: (...args: unknown[]) => void;
    __redditPixelInitialized?: boolean;
  }
}

const PIXEL_ID = "a2_hz2ukgenc938" as const;

export default function RedditPixel() {
  // Do not load or run the pixel in development
  if (process.env.NODE_ENV === "development") {
    return null;
  }

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loadedRef = useRef(false);

  // Initialize Reddit Pixel once when the script loads on the client.
  const handleScriptLoad = () => {
    if (typeof window === "undefined") return;
    if (window.__redditPixelInitialized) return;

    if (typeof window.rdt === "function") {
      window.rdt("init", PIXEL_ID);
      window.rdt("track", "PageVisit");
      window.__redditPixelInitialized = true;
      loadedRef.current = true;
    }
  };

  // Track client-side navigations (App Router) once initialized.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // If the script has already loaded and init ran, track route changes.
    if (window.__redditPixelInitialized && typeof window.rdt === "function") {
      window.rdt("track", "PageVisit");
      return;
    }

    // If we haven't seen onLoad yet (slow network), don't attempt to queue here.
    // The initial PageVisit will be sent in handleScriptLoad.
  }, [pathname, searchParams]);

  return (
    <>
      {/* Load the official Reddit Pixel script asynchronously in the browser */}
      <Script
        id="reddit-pixel"
        src="https://www.redditstatic.com/ads/pixel.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
    </>
  );
}
