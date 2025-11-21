// app/(whatever)/new-audio-client.tsx
"use client";

import FaqSection, { FaqItem } from "@/components/faq-section";
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
import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import { AdvancedAudioForm } from "../_components/advanced-audio-form";
import { AiModeForm } from "./_modes/ai-mode-form";
import { CopyModeForm } from "./_modes/copy-mode-form";
import { RoyalRoadModeForm } from "./_modes/royal-road-mode-form";
import { UploadModeForm } from "./_modes/upload-mode-form";

const copyFaqs: FaqItem[] = [
  {
    question: "What if I want to convert a PDF to audio?",
    answer: (
      <>
        We support that! Go over to our{" "}
        <Link
          href="/audio-file/new?mode=upload"
          className="text-orange-500 underline transition-colors hover:text-orange-400"
        >
          PDF converter page
        </Link>{" "}
        for that!
      </>
    ),
  },
  {
    question: "How do I paste a link and get the ebook transcribed?",
    answer: (
      <>
        We offer{" "}
        <Link
          href="/audio-file/new?mode=royal-road"
          className="text-orange-500 underline transition-colors hover:text-orange-400"
        >
          Royal Road transcriptions
        </Link>
        .
      </>
    ),
  },
  {
    question: "Do credits carry over for subscribers?",
    answer: "Absolutely!",
  },
  {
    question: "Can I adjust reading speed?",
    answer:
      "Yes, once you transcribe your audio you will be able to adjust the speed accordingly.",
  },
  {
    question: "Can I export the audios I create?",
    answer:
      "Absolutely, as an MP3. If you'd like support for other formats, please let us know.",
  },
  {
    question: "What is the max size of the context window?",
    answer:
      "The system is built for long-form content and handles large texts without manual chunking. If you hit an edge case, split by natural chapters and we'll stitch cleanly with consistent pacing.",
  },
];

const uploadFaqs: FaqItem[] = [
  {
    question: "How do I convert a PDF to audio on Instantaudio?",
    answer:
      "Upload your PDF, choose a voice, and click generate. Instantaudio instantly turns your document into a high-quality audio file.",
  },
  {
    question: "What file types can I upload?",
    answer:
      "You can upload PDFs and text files - feel free to email us if there are other file types you'd like to see.",
  },
  {
    question: "Is there a file size limit for uploads?",
    answer:
      "Never. If you have the credits you can upload anything you'd like.",
  },
  {
    question: "Can I download the audiobook after converting?",
    answer:
      "Yes. Once your audio is generated, you can download the MP3 file directly.",
  },
  {
    question: "Does Instantaudio support long documents or books?",
    answer:
      "Yes. The tool handles long PDFs, textbooks, research papers, and full eBook chapters using a large context window.",
  },
  {
    question: "Can I choose different voices for my audiobook?",
    answer:
      "Absolutely. Instantaudio offers multiple natural AI voices so you can pick the narration style you prefer.",
  },
  {
    question: "Is my uploaded document private?",
    answer:
      "Yes. Your files are processed securely and not shared or stored beyond what's needed to generate your audio.",
  },
  {
    question: "Can I listen on mobile?",
    answer:
      "Yes. Instantaudio works on phones, tablets, and desktops, and you can download audio to listen offline.",
  },
  {
    question: "How fast is the conversion?",
    answer:
      "Most PDFs convert into audio within seconds to a few minutes depending on document length.",
  },
  {
    question: "Does Instantaudio work for people with reading difficulties?",
    answer:
      "Yes. Many users rely on Instantaudio for accessibility - helping with dyslexia, eye strain, or reading large amounts of text.",
  },
  {
    question: "Can I paste text outright?",
    answer: (
      <>
        Yes, you can do this on our{" "}
        <Link
          href="/audio-file/new?mode=copy"
          className="text-orange-500 underline transition-colors hover:text-orange-400"
        >
          text to audio page
        </Link>
        .
      </>
    ),
  },
  {
    question: "Can I paste an ebook chapter?",
    answer: (
      <>
        Yes, you can paste any{" "}
        <Link
          href="/audio-file/new?mode=royal-road"
          className="text-orange-500 underline transition-colors hover:text-orange-400"
        >
          Royal Road chapter here
        </Link>
        .
      </>
    ),
  },
];

const royalRoadFaqs: FaqItem[] = [
  {
    question: "How do I convert a Royal Road ebook to audio?",
    answer:
      "Paste the Royal Road chapter or fiction URL, choose a voice, and click generate. Instantaudio instantly turns your ebook into a high-quality audio file.",
  },
  {
    question: "Can I convert an entire Royal Road series?",
    answer:
      "Yes. You can paste individual chapter URLs or the main fiction page URL to convert full series into audiobooks.",
  },
  {
    question: "What Royal Road formats are supported?",
    answer:
      "Any public Royal Road fiction or chapter URL works. Just paste the link and we'll handle the rest.",
  },
  {
    question: "Can I download the audiobook after converting?",
    answer:
      "Yes. Once your audio is generated, you can download the MP3 file directly to listen offline.",
  },
  {
    question: "Does this work for long Royal Road novels?",
    answer:
      "Absolutely. The tool handles full-length novels, web serials, and multi-chapter stories using a large context window.",
  },
  {
    question: "Can I choose different voices for narration?",
    answer:
      "Yes. Instantaudio offers multiple natural AI voices so you can pick the narration style that fits your story best.",
  },
  {
    question: "Is the content I convert private?",
    answer:
      "Yes. Your URLs are processed securely and not shared. We only access public Royal Road content to generate your audio.",
  },
  {
    question: "Can I listen on mobile?",
    answer:
      "Yes. Instantaudio works on phones, tablets, and desktops, and you can download audio to listen anywhere.",
  },
  {
    question: "How fast is the conversion?",
    answer:
      "Most Royal Road chapters convert into audio within seconds to a few minutes depending on chapter length.",
  },
  {
    question: "Does this work for other web fiction sites?",
    answer:
      "Currently we specialize in Royal Road, but feel free to email us if there are other platforms you'd like to see supported.",
  },
  {
    question: "Can I use text or PDF instead?",
    answer: (
      <>
        Yes, you can use our{" "}
        <Link
          href="/audio-file/new?mode=copy"
          className="text-orange-500 underline transition-colors hover:text-orange-400"
        >
          text to audiobook
        </Link>{" "}
        or{" "}
        <Link
          href="/audio-file/new?mode=upload"
          className="text-orange-500 underline transition-colors hover:text-orange-400"
        >
          PDF to audio
        </Link>{" "}
        converters.
      </>
    ),
  },
  {
    question: "Do I need a Royal Road account?",
    answer:
      "No. You just need the public URL of the fiction or chapter you want to convert. No account required.",
  },
];

const NewAudioClient = ({ speakers }: { speakers: Speaker[] }) => {
  const [mode, setMode] = useQueryState(
    "mode",
    parseAsString.withDefault("").withOptions({})
  );

  return (
    <>
      <div className="container mx-auto p-4 flex flex-col md:justify-center max-w-5xl pt-20">
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
              <>
                <CopyModeForm speakers={speakers} onBack={() => setMode("")} />
                <div className="my-32"></div>
                <FaqSection
                  faqs={copyFaqs}
                  title="FAQ: Copy & Paste Text"
                  description={
                    <>
                      Looking for PDF upload or Royal Road? Jump straight to the{" "}
                      <Link
                        href="/audio-file/new?mode=upload"
                        className="text-orange-500 underline transition-colors hover:text-orange-400"
                      >
                        PDF converter
                      </Link>{" "}
                      or{" "}
                      <Link
                        href="/audio-file/new?mode=royal-road"
                        className="text-orange-500 underline transition-colors hover:text-orange-400"
                      >
                        Royal Road importer
                      </Link>
                      .
                    </>
                  }
                  className="pt-10"
                />
              </>
            )}
            {mode === "upload" && (
              <>
                <UploadModeForm
                  speakers={speakers}
                  onBack={() => setMode("")}
                />
                <div className="my-32"></div>
                <FaqSection
                  faqs={uploadFaqs}
                  title="FAQ: PDF/Text Upload"
                  description={
                    <>
                      Prefer to paste text or a Royal Road link? Try the{" "}
                      <Link
                        href="/audio-file/new?mode=copy"
                        className="text-orange-500 underline transition-colors hover:text-orange-400"
                      >
                        text to audio
                      </Link>{" "}
                      or{" "}
                      <Link
                        href="/audio-file/new?mode=royal-road"
                        className="text-orange-500 underline transition-colors hover:text-orange-400"
                      >
                        Royal Road
                      </Link>{" "}
                      flows.
                    </>
                  }
                  className="pt-10"
                />
              </>
            )}
            {mode === "royal-road" && (
              <>
                <RoyalRoadModeForm
                  speakers={speakers}
                  onBack={() => setMode("")}
                />
                <div className="my-32"></div>
                <FaqSection
                  faqs={royalRoadFaqs}
                  title="FAQ: Royal Road"
                  description={
                    <>
                      Want other sources? Switch to{" "}
                      <Link
                        href="/audio-file/new?mode=copy"
                        className="text-orange-500 underline transition-colors hover:text-orange-400"
                      >
                        text to audiobook
                      </Link>{" "}
                      or{" "}
                      <Link
                        href="/audio-file/new?mode=upload"
                        className="text-orange-500 underline transition-colors hover:text-orange-400"
                      >
                        PDF to audio
                      </Link>{" "}
                      for direct uploads.
                    </>
                  }
                  className="pt-10"
                />
              </>
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
