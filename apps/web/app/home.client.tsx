"use client";

import SimpleAudioClip from "@/components/audio/simple-audio-clip";
import FaqSection, { FaqItem } from "@/components/faq-section";
import Logo from "@/components/svgs/logo";
import { AudioFile, Speaker } from "@workspace/database";
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
import { TestimonialsColumn } from "@/components/testimonials-columns";
import { env } from "@/env";
import { authClient } from "@/lib/auth-client";

const homeFaqs: FaqItem[] = [
  {
    value: "faq-what-is",
    question: "What is InstantAudio.online?",
    answer: (
      <>
        A tool for turning long-form text (books, articles, scripts) into
        polished audiobooks with chapters, smooth stitching, and single-file
        exports (MP3).
      </>
    ),
  },
  {
    value: "faq-how-it-works",
    question: "How does it work?",
    answer: (
      <>
        Paste or upload text, pick a voice, preview a short clip, then render
        the full book. Exports include MP3 (with chapter markers).
      </>
    ),
  },
  {
    value: "faq-ownership",
    question: "Who owns the audio I create?",
    answer: (
      <>
        You own the output you generate. If your text uses third-party IP,
        you’re responsible for having the rights. Don’t publicly share content
        you don’t own or lack permission to distribute. See{" "}
        <Link href="/term" className="underline underline-offset-2">
          Terms
        </Link>
        .
      </>
    ),
  },
  {
    value: "faq-commercial-use",
    question: "Can I use the audio commercially?",
    answer: (
      <>
        Starter is for non-commercial use and may include a
        watermark/attribution. Paid plans allow commercial use of the audio you
        create (subject to owning or licensing the underlying text). Always
        follow our{" "}
        <Link href="/term" className="underline underline-offset-2">
          Terms
        </Link>
        .
      </>
    ),
  },
  {
    value: "faq-characters",
    question: "How do characters/credits translate to audio length?",
    answer: (
      <>
        A rough guide: Approximately 5 characters equal 1 word, and narration
        averages about 150 words per minute. For example, 100,000 characters
        produce roughly 20,000 words, resulting in an estimated 133 minutes of
        audio (about 2 hours and 13 minutes). Actual length may vary based on
        voice and pacing.
      </>
    ),
  },
  {
    value: "faq-rollover",
    question: "Do unused characters roll over?",
    answer: (
      <>
        Yes—unused characters roll over while your subscription is active. You
        can also purchase extra when you need to.
      </>
    ),
  },
  {
    value: "faq-formats",
    question: "What export formats are supported?",
    answer: (
      <>
        MP3. If you&apos;d like support for other formats, please let us know.
      </>
    ),
  },
  {
    value: "faq-voices",
    question: "What voices are available? Can I customize?",
    answer: (
      <>
        You’ll find a curated voice library tuned for narration. On higher
        tiers, you can fine-tune settings and may have a custom voice slot.
        Support for SSML controls (pronunciation, emphasis, pauses) is available
        on paid plans.
      </>
    ),
  },
  {
    value: "faq-privacy",
    question: "Is my project private? Can I share it?",
    answer: (
      <>
        Projects are private by default. You can keep them private or share an
        unlisted preview link. Only share publicly if you own the rights to the
        underlying text.
      </>
    ),
  },
  {
    value: "faq-limits",
    question: "How big can my book be?",
    answer: (
      <>
        The system is built for long-form content and handles large texts
        without manual chunking. If you hit an edge case, split by natural
        chapters and we’ll stitch cleanly with consistent pacing.
      </>
    ),
  },
  {
    value: "faq-languages",
    question: "What languages do you support?",
    answer: (
      <>
        English is fully supported with multiple narration styles. Additional
        languages and accents are available depending on voice; availability may
        vary by plan.
      </>
    ),
  },
  {
    value: "faq-cancel",
    question: "Can I cancel anytime? What happens to rollover?",
    answer: (
      <>
        You can cancel anytime. You keep access through the end of the billing
        period. Rollover applies while you’re subscribed; it pauses if your plan
        lapses and resumes when you reactivate.
      </>
    ),
  },
  {
    value: "faq-support",
    question: "How do I report an issue or takedown request?",
    answer: (
      <>
        Contact support from your dashboard or email our abuse/takedown address
        in the{" "}
        <Link href="/term" className="underline underline-offset-2">
          Terms
        </Link>
        . Include links, proof of ownership (if applicable), and any error
        details.
      </>
    ),
  },
];

export type HomeClientProps = {
  af: AudioFile;
  speaker: Speaker;
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
              <CardTitle>Sample: {props.af.name}</CardTitle>
              <CardDescription>
                <span className="text-foreground/70">
                  Narrated By: {props.speaker.displayName} Diaz
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

        {/* Testimonials */}
        <section className="relative py-10 mb-20 min-h-dvh">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-4">
              <div className="flex justify-center">
                <div className="rounded-lg border px-4 py-1">Testimonials</div>
              </div>

              <h2 className="font-bold text-3xl tracking-tighter lg:text-4xl">
                What our users say
              </h2>
              <p className="text-center text-muted-foreground text-sm">
                Feedback from authors, educators, and publishers.
              </p>
            </div>

            {(() => {
              const testimonials = [
                {
                  text: "Turned a 120k‑word web serial into a clean MP3 overnight. No manual chunking—chapters were detected automatically.",
                  image: "https://randomuser.me/api/portraits/women/21.jpg",
                  name: "Maya Chen",
                  role: "Web Serial Author",
                },
                {
                  text: "The smart chapter breaks and natural padding make it sound human. I pasted my manuscript and hit render.",
                  image: "https://randomuser.me/api/portraits/men/32.jpg",
                  name: "Alex Romero",
                  role: "Indie Author",
                },
                {
                  text: "Rollover credits mean I never waste a month. When a big upload hits, overage pricing is predictable.",
                  image: "https://randomuser.me/api/portraits/women/45.jpg",
                  name: "Priya Patel",
                  role: "Content Creator",
                },
                {
                  text: "Our 18‑hour training course exported as a single file with chapter markers—exactly what we needed.",
                  image: "https://randomuser.me/api/portraits/men/65.jpg",
                  name: "Jordan Blake",
                  role: "Head of L&D",
                },
                {
                  text: "Voices are surprisingly good for long narration. Listeners assumed it was a studio read.",
                  image: "https://randomuser.me/api/portraits/women/12.jpg",
                  name: "Elena Park",
                  role: "Podcaster",
                },
                {
                  text: "Fast turnaround and a simple hosted player link we share with beta readers.",
                  image: "https://randomuser.me/api/portraits/men/77.jpg",
                  name: "Samir Khan",
                  role: "Small Publisher",
                },
                {
                  text: "I stitched multiple chapters with no clicks between them—the transitions feel natural.",
                  image: "https://randomuser.me/api/portraits/men/23.jpg",
                  name: "Noah Williams",
                  role: "Hobby Audio Editor",
                },
                {
                  text: "Great value: a million characters gets ~25 hours. The pricing is easy to plan around.",
                  image: "https://randomuser.me/api/portraits/women/36.jpg",
                  name: "Rachel Lee",
                  role: "Community Manager",
                },
                {
                  text: "Support helped map our TOC so chapter jumps line up perfectly—super responsive.",
                  image: "https://randomuser.me/api/portraits/women/68.jpg",
                  name: "Olivia Grant",
                  role: "Editor",
                },
              ];

              const firstColumn = testimonials.slice(0, 3);
              const secondColumn = testimonials.slice(3, 6);
              const thirdColumn = testimonials.slice(6, 9);

              return (
                <div className="mt-10 flex max-h-[740px] justify-center gap-6 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)]">
                  <TestimonialsColumn
                    duration={16}
                    testimonials={firstColumn}
                  />
                  <TestimonialsColumn
                    className="hidden md:block"
                    duration={20}
                    testimonials={secondColumn}
                  />
                  <TestimonialsColumn
                    className="hidden lg:block"
                    duration={18}
                    testimonials={thirdColumn}
                  />
                </div>
              );
            })()}
          </div>
        </section>

        <FaqSection
          faqs={homeFaqs}
          className="px-6"
          description={
            <>
              Short answers below. Need more? View the{" "}
              <Link href="/term" className="underline underline-offset-2">
                terms.
              </Link>
            </>
          }
        />
      </div>
      <FooterSection />
    </>
  );
}
