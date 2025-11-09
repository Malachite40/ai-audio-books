// app/(whatever)/new-audio-client.tsx
"use client";

import { Speaker } from "@workspace/database";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  UploadIcon,
  Wand2,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { AdvancedAudioForm } from "../_components/advanced-audio-form";
import { AiModeForm } from "./_modes/ai-mode-form";
import { CopyModeForm } from "./_modes/copy-mode-form";
import { RoyalRoadModeForm } from "./_modes/royal-road-mode-form";
import { UploadModeForm } from "./_modes/upload-mode-form";

const NewAudioClient = ({ speakers }: { speakers: Speaker[] }) => {
  const [mode, setMode] = useQueryState(
    "mode",
    parseAsString.withDefault("").withOptions({})
  );

  return (
    <>
      <div className="container mx-auto p-4 flex flex-col md:justify-center max-w-5xl">
        {!mode && (
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight mb-4">
              How would you like to start?
            </h1>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  key: "copy",
                  mode: "copy" as const,
                  label: "Copy & paste text",
                  description: "Paste your text. Quick and simple.",
                  Icon: ClipboardList,
                },
                {
                  key: "upload",
                  mode: "upload" as const,
                  label: "Upload file",
                  description:
                    "Upload a .txt or .pdf and we’ll extract the text.",
                  Icon: UploadIcon,
                },
                {
                  key: "ai",
                  mode: "ai" as const,
                  label: "Generate from AI",
                  description:
                    "Give a prompt and generate a story with a length of your choice.",
                  Icon: Wand2,
                },
                {
                  key: "royal-road",
                  mode: "royal-road" as const,
                  label: "RoyalRoad Chapter",
                  description:
                    "Paste a RoyalRoad chapter URL to generate audio from it.",
                  Icon: BookOpen,
                },
                // {
                //   key: "advanced",
                //   mode: "advanced" as const,
                //   label: "Advanced",
                //   description:
                //     "Add titles and chapter headings. Control pauses and more.",
                //   Icon: AudioLinesIcon,
                // },
              ].map((option) => (
                <Card
                  key={option.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setMode(option.mode)}
                  className="cursor-pointer transition hover:border-primary"
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <option.Icon className="h-5 w-5" />
                      {option.label}
                    </CardTitle>
                    <CardDescription>{option.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-end">
                    <Button onClick={() => setMode(option.key)}>
                      <ArrowRight className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Mode-specific forms */}
        {mode && mode !== "advanced" && (
          <>
            {mode === "copy" && (
              <CopyModeForm speakers={speakers} onBack={() => setMode("")} />
            )}
            {mode === "upload" && (
              <UploadModeForm speakers={speakers} onBack={() => setMode("")} />
            )}
            {mode === "royal-road" && (
              <RoyalRoadModeForm
                speakers={speakers}
                onBack={() => setMode("")}
              />
            )}
            {mode === "ai" && (
              <AiModeForm speakers={speakers} onBack={() => setMode("")} />
            )}
          </>
        )}

        {mode && mode === "advanced" && (
          <AdvancedAudioForm speakers={speakers} />
        )}
      </div>
    </>
  );
};

export default NewAudioClient;
