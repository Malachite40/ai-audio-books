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
  const didMount = useRef(false);

  // Track client-side navigations (App Router) once initialized.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Skip initial render: initial PageVisit is queued in bootstrap below.
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    // Track client-side navigation; stub queues if pixel not ready yet.
    if (typeof window.rdt === "function") {
      window.rdt("track", "PageVisit");
    }
  }, [pathname, searchParams]);

  return (
    <>
      {/* Bootstrap rdt queue and queue initial init + PageVisit */}
      <Script
        id="reddit-pixel-bootstrap"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d){
              if(!w.rdt){
                var p=w.rdt=function(){
                  p.sendEvent ? p.sendEvent.apply(p, arguments) : p.callQueue.push(arguments);
                };
                p.callQueue=[]; p.t=+new Date; p.version='0.3';
              }
              if(!w.__redditPixelInitialized){
                w.rdt('init','${PIXEL_ID}');
                w.rdt('track','PageVisit');
                w.__redditPixelInitialized = true;
              }
              // Send a one-time test event with a unique conversionId for deduplication
              if(!w.__redditTestEventSent){
                var cid = 'test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,10);
                w.rdt('track','TestEvent', { conversionId: cid });
                w.__redditTestEventSent = true;
              }
            })(window,document);
          `,
        }}
      />
      {/* Load the official Reddit Pixel script asynchronously in the browser */}
      <Script id="reddit-pixel" src="https://www.redditstatic.com/ads/pixel.js" strategy="afterInteractive" />
    </>
  );
}
