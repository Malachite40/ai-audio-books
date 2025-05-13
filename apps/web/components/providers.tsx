"use client";

import { TRPCReactProvider } from "@/trpc/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import * as React from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <NuqsAdapter>{children}</NuqsAdapter>
    </TRPCReactProvider>
  );
}
