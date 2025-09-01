"use client";

import SimpleAudioClip from "@/components/audio/simple-audio-clip";
import Logo from "@/components/svgs/logo";
import { AudioFile } from "@workspace/database";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  ArrowBigRight,
  ArrowDown,
  ArrowRight,
  AudioLines,
  BookOpen,
  Download,
  LibraryBig,
  ListChecks,
  Mic2,
  RotateCcw,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

// NEW: accordion components
import FooterSection from "@/components/footer";
import { env } from "@/env";
import { authClient } from "@/lib/auth-client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";

export type HomeClientProps = {
  af: AudioFile;
};

export function HomeClient(props: HomeClientProps) {
  const howRef = useRef<HTMLDivElement>(null);

  const scrollToHow = () => {
    if (howRef.current) {
      howRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      // Fallback: slide by one viewport height
      window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
    }
  };

  return (
    <>
      <div className="min-h-screen w-dwv scroll-smooth snap-y">
        {/* HERO */}
        <section className="h-dvh flex flex-col justify-center items-center p-6 space-y-6 ">
          <div className="mt-0 md:mt-10" />
          <Logo className="size-20  min-h-20 min-w-20  fill-primary" />

          <div className="flex flex-col text-center gap-2">
            <h1 className="text-3xl text-foreground/70">Instantly Create</h1>
            <h1 className="text-5xl text-primary font-semibold">Audio Books</h1>
          </div>

          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Listen to a Sample Audio Book</CardTitle>
              <CardDescription>
                <span className="text-foreground/70">
                  Sample: {props.af.name}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleAudioClip af={props.af} />
            </CardContent>
          </Card>

          {/* Create Audio Book Button */}
          <Link
            href="/audio-file/new"
            className={buttonVariants({
              variant: "link",
              size: "lg",
            })}
          >
            <AudioLines className="size-5" />
            <span className="text-lg">Create Audio Book</span>
          </Link>

          {/* Explore Our Library Button */}
          <Link
            href="/discover"
            className={buttonVariants({
              variant: "link",
              size: "lg",
            })}
          >
            <LibraryBig className="size-5" />
            <span className="text-lg">Explore Our Library</span>
          </Link>

          {/* Sign In Button */}
          <Button
            variant={"link"}
            size={"lg"}
            onClick={() => {
              authClient.signIn.social({
                provider: "google",
                callbackURL: env.NEXT_PUBLIC_BASE_URL + "/audio-file/new",
              });
            }}
          >
            <span className="text-lg">Sign In</span>
            <ArrowBigRight className="size-5" />
          </Button>

          {/* How it works trigger */}
          <div
            className="mt-auto flex-col text-foreground/20 gap-2 w-full flex justify-center items-center cursor-pointer select-none"
            onClick={scrollToHow}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") scrollToHow();
            }}
          >
            <span>How it works</span>
            <ArrowDown className="size-8" />
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section
          ref={howRef}
          className="min-h-dvh w-full p-6 flex flex-col items-center justify-center gap-8 bg-muted/30 "
        >
          <div className="max-w-5xl w-full space-y-6">
            {/* title */}
            <div>
              <h2 className="text-2xl font-bold">How it works</h2>
              <p className="text-sm text-foreground/70">{`It's as easy as 1-2. Try it out for free!`}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-6">
              {/* 1) Input Demo */}
              <div className="w-full">
                <label className="block text-sm mb-2 text-foreground/70">
                  1) Paste your text
                </label>
                <Textarea
                  disabled
                  value="Once upon a time in a land far, far away where the sun shone brightly and the birds sang sweetly, there lived a young girl named Alice."
                  className="w-full h-32 rounded-xl border bg-background/60 p-4 text-foreground/60 shadow-sm outline-none disabled:cursor-not-allowed"
                />
                <p className="mt-2 text-xs text-foreground/50">
                  Large text supported — no manual chunking.
                </p>
              </div>

              {/* Arrow pointer */}
              <div className="hidden md:flex justify-center">
                <ArrowRight className="h-12 w-12 text-foreground/30" />
              </div>
              <div className="md:hidden flex justify-center">
                <ArrowDown className="h-10 w-10 text-foreground/30" />
              </div>

              {/* 2) Audio Demo */}
              <div className="w-full">
                <label className="block text-sm mb-2 text-foreground/70">
                  2) Preview
                </label>
                <Card className="w-full">
                  <CardHeader>
                    <CardTitle className="text-base">
                      Your Audio Preview
                    </CardTitle>
                    <CardDescription>
                      <span className="text-foreground/70">
                        Sample: {props.af.name}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SimpleAudioClip af={props.af} />
                  </CardContent>
                </Card>
              </div>

              {/* Try it now */}
              <div className="md:col-span-3 ml-auto">
                <Link href="/audio-file/new" className={buttonVariants({})}>
                  <span>Try it now</span>
                </Link>
              </div>
            </div>

            {/* Key Features arrow*/}
          </div>
        </section>

        {/* KEY POINTS */}
        <section className="min-h-dvh w-full p-6 flex items-center justify-center ">
          <div className="max-w-5xl w-full">
            <h2 className="text-2xl font-bold mb-6">Why creators like it</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Big Text */}
              <Card>
                <CardHeader className="space-y-1">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    <CardTitle className="text-base">
                      Handles Big Text
                    </CardTitle>
                  </div>
                  <CardDescription>
                    No manual chunking — paste entire book or doc.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-foreground/70 space-y-1 list-disc pl-5">
                    <li>Built for long-form docs</li>
                    <li>Smart pacing to avoid mid-sentence cuts</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Chapters & Stitching */}
              <Card>
                <CardHeader className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-5 w-5" />
                    <CardTitle className="text-base">
                      Chapters & Stitching
                    </CardTitle>
                  </div>
                  <CardDescription>
                    Auto breaks, natural padding, smooth joins.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-foreground/70 space-y-1 list-disc pl-5">
                    <li>Clean transitions between sections</li>
                    <li>Chapter markers included in M4B</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Single File Export */}
              <Card>
                <CardHeader className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    <CardTitle className="text-base">
                      Single-File Export
                    </CardTitle>
                  </div>
                  <CardDescription>
                    Take it anywhere — MP3 or M4B.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-foreground/70 space-y-1 list-disc pl-5">
                    <li>Great for phones & car players</li>
                    <li>Works with podcast/ebook apps</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Hosted Player */}
              <Card>
                <CardHeader className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Share2 className="h-5 w-5" />
                    <CardTitle className="text-base">
                      Instant Preview Player
                    </CardTitle>
                  </div>
                  <CardDescription>
                    Listen in the browser immediately.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-foreground/70 space-y-1 list-disc pl-5">
                    <li>Share a link or keep it private</li>
                    <li>Jump between chapters quickly</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Voice Library */}
              <Card>
                <CardHeader className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Mic2 className="h-5 w-5" />
                    <CardTitle className="text-base">
                      Curated Voice Library
                    </CardTitle>
                  </div>
                  <CardDescription>
                    Pick a tone that fits your story.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-foreground/70 space-y-1 list-disc pl-5">
                    <li>Neural voices tuned for narration</li>
                    <li>Consistent quality across chapters</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Rollover Credits */}
              <Card>
                <CardHeader className="space-y-1">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-5 w-5" />
                    <CardTitle className="text-base">
                      Rollover Characters
                    </CardTitle>
                  </div>
                  <CardDescription>
                    Unused characters don’t go to waste.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-foreground/70 space-y-1 list-disc pl-5">
                    <li>Simple, predictable pricing</li>
                    <li>Buy extra only when you need</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Subscribe CTA */}
            <div className="mt-6 flex justify-center">
              <Link href="/pricing" className={buttonVariants({})}>
                View Pricing
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ (Accordion) */}
        <section className="min-h-dvh w-full p-6 ">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold mb-2">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-foreground/70 mb-6 flex gap-1">
              Short answers below. Need more? View the
              <Link href="/term" className="underline underline-offset-2">
                terms.
              </Link>
            </p>

            <Accordion type="multiple" className="w-full">
              <AccordionItem value="faq-what-is">
                <AccordionTrigger>
                  What is InstantAudio.online?
                </AccordionTrigger>
                <AccordionContent>
                  A tool for turning long-form text (books, articles, scripts)
                  into polished audiobooks with chapters, smooth stitching, and
                  single-file exports (MP3).
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-how-it-works">
                <AccordionTrigger>How does it work?</AccordionTrigger>
                <AccordionContent>
                  Paste or upload text, pick a voice, preview a short clip, then
                  render the full book. Exports include MP3 (with chapter
                  markers).
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-ownership">
                <AccordionTrigger>
                  Who owns the audio I create?
                </AccordionTrigger>
                <AccordionContent>
                  {`You own the output you generate. If your text uses third-party
                IP, you’re responsible for having the rights. Don’t publicly
                share content you don’t own or lack permission to distribute.
                See`}
                  <Link href="/term" className="underline underline-offset-2">
                    Terms
                  </Link>
                  .
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-commercial-use">
                <AccordionTrigger>
                  Can I use the audio commercially?
                </AccordionTrigger>
                <AccordionContent>
                  Starter is for non-commercial use and may include a
                  watermark/attribution. Paid plans allow commercial use of the
                  audio you create (subject to owning or licensing the
                  underlying text). Always follow our
                  <Link href="/term" className="underline underline-offset-2">
                    Terms
                  </Link>
                  .
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-characters">
                <AccordionTrigger>
                  How do characters/credits translate to audio length?
                </AccordionTrigger>
                <AccordionContent>
                  {`A rough guide: Approximately 5 characters equal 1 word, and narration averages about 150 words per minute. For example, 100,000 characters produce roughly 20,000 words, resulting in an estimated 133 minutes of audio (about 2 hours and 13 minutes). Actual length may vary based on voice and pacing.`}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-rollover">
                <AccordionTrigger>
                  Do unused characters roll over?
                </AccordionTrigger>
                <AccordionContent>
                  Yes—unused characters roll over while your subscription is
                  active. You can also purchase extra when you need to.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-formats">
                <AccordionTrigger>
                  What export formats are supported?
                </AccordionTrigger>
                <AccordionContent>
                  {`MP3. If you'd like support for other formats, please let us know.`}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-voices">
                <AccordionTrigger>
                  What voices are available? Can I customize?
                </AccordionTrigger>
                <AccordionContent>
                  {`You’ll find a curated voice library tuned for narration. On
                higher tiers, you can fine-tune settings and may have a custom
                voice slot. Support for SSML controls (pronunciation, emphasis,
                pauses) is available on paid plans.`}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-privacy">
                <AccordionTrigger>
                  Is my project private? Can I share it?
                </AccordionTrigger>
                <AccordionContent>
                  Projects are private by default. You can keep them private or
                  share an unlisted preview link. Only share publicly if you own
                  the rights to the underlying text.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-limits">
                <AccordionTrigger>How big can my book be?</AccordionTrigger>
                <AccordionContent>
                  {`The system is built for long-form content and handles large
                texts without manual chunking. If you hit an edge case, split by
                natural chapters and we’ll stitch cleanly with consistent
                pacing.`}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-languages">
                <AccordionTrigger>
                  What languages do you support?
                </AccordionTrigger>
                <AccordionContent>
                  English is fully supported with multiple narration styles.
                  Additional languages and accents are available depending on
                  voice; availability may vary by plan.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-cancel">
                <AccordionTrigger>
                  Can I cancel anytime? What happens to rollover?
                </AccordionTrigger>
                <AccordionContent>
                  {`You can cancel anytime. You keep access through the end of the
                billing period. Rollover applies while you’re subscribed; it
                pauses if your plan lapses and resumes when you reactivate.`}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-support">
                <AccordionTrigger>
                  How do I report an issue or takedown request?
                </AccordionTrigger>
                <AccordionContent>
                  Contact support from your dashboard or email our
                  abuse/takedown address in the
                  <Link href="/term" className="underline underline-offset-2">
                    Terms
                  </Link>
                  . Include links, proof of ownership (if applicable), and any
                  error details.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>
      </div>
      <FooterSection />
    </>
  );
}
