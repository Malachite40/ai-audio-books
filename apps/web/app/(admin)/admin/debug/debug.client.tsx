"use client";

import { DebugInfoCard } from "../_components/debug-info-card";
import MemoryStressCard from "../_components/memory-stress-card";

export function DebugClientPage() {
  return (
    <div className="container mx-auto p-4 gap-4 flex flex-col">
      <MemoryStressCard />
      <DebugInfoCard />
    </div>
  );
}
