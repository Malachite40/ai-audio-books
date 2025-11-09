"use client";

import { Speaker } from "@workspace/database";
import { CopyModeForm } from "./copy-mode-form";

type Props = { speakers: Speaker[]; onBack: () => void };

export function RoyalRoadModeForm({ speakers, onBack }: Props) {
  return (
    <CopyModeForm
      speakers={speakers}
      onBack={onBack}
      label="RoyalRoad URL"
      placeholder="Paste a RoyalRoad chapter URL"
    />
  );
}

