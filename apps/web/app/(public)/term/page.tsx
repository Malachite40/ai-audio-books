// app/terms/page.tsx

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { AlertCircleIcon, CheckCircle2Icon, PopcornIcon } from "lucide-react";
import type { Metadata } from "next";

const SITE_NAME = "InstantAudio.online";
const LAST_UPDATED = "2025-08-30"; // YYYY-MM-DD
const CONTACT_EMAIL = "support@instantaudio.online"; // <-- update if needed
const JURISDICTION = "Washington"; // e.g., "California, USA"

export const metadata: Metadata = {
  title: `Terms & Conditions — ${SITE_NAME}`,
  description:
    "Terms & Conditions for Instantaudio.online, covering user content ownership, IP restrictions, acceptable use, and more.",
  alternates: { canonical: "https://instantaudio.online/terms" },
  robots: { index: true, follow: true },
  openGraph: {
    title: `Terms & Conditions — ${SITE_NAME}`,
    description:
      "Read Instantaudio.online's Terms & Conditions: ownership of generated content, IP & sharing rules, acceptable use, limitations, and more.",
    url: "https://instantaudio.online/terms",
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Terms & Conditions — ${SITE_NAME}`,
    description:
      "Instantaudio.online Terms & Conditions: content ownership and IP rules.",
  },
};

export default function TermsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LegalService",
    name: SITE_NAME,
    url: "https://instantaudio.online/terms",
    areaServed: "Worldwide",
    termsOfService: "https://instantaudio.online/terms",
    dateModified: LAST_UPDATED,
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Terms &amp; Conditions
        </h1>
        <p className="text-sm text-neutral-600">
          Last Updated: {new Date(LAST_UPDATED).toLocaleDateString()}
        </p>
      </header>

      {/* Table of Contents */}
      <nav
        aria-label="Table of contents"
        className="mb-10 bg-background border border-border rounded-lg p-5"
      >
        <h2 className="text-lg font-semibold mb-2">Table of Contents</h2>
        <ol className="list-decimal list-inside space-y-1 text-base">
          <li>
            <a href="#eligibility" className="hover:underline">
              Eligibility
            </a>
          </li>
          <li>
            <a href="#ownership" className="hover:underline">
              Ownership of Content
            </a>
          </li>
          <li>
            <a href="#ip-sharing" className="hover:underline">
              Intellectual Property &amp; Sharing Restrictions
            </a>
          </li>
          <li>
            <a href="#acceptable-use" className="hover:underline">
              Acceptable Use
            </a>
          </li>
          <li>
            <a href="#our-ip" className="hover:underline">
              Our Intellectual Property
            </a>
          </li>
          <li>
            <a href="#availability" className="hover:underline">
              Service Availability &amp; Changes
            </a>
          </li>
          <li>
            <a href="#disclaimers" className="hover:underline">
              Disclaimers
            </a>
          </li>
          <li>
            <a href="#limitation" className="hover:underline">
              Limitation of Liability
            </a>
          </li>
          <li>
            <a href="#termination" className="hover:underline">
              Termination
            </a>
          </li>
          <li>
            <a href="#law" className="hover:underline">
              Governing Law
            </a>
          </li>
          <li>
            <a href="#changes" className="hover:underline">
              Changes to Terms
            </a>
          </li>
          <li>
            <a href="#contact" className="hover:underline">
              Contact
            </a>
          </li>
        </ol>
      </nav>

      <article className="prose prose-neutral max-w-none">
        <p>
          Welcome to <strong>{SITE_NAME}</strong> (“we,” “our,” or “us”). These
          Terms &amp; Conditions (“Terms”) govern your use of our text-to-speech
          audiobook service (“Service”). By accessing or using the Service, you
          agree to be bound by these Terms. If you do not agree, you may not use
          the Service.
        </p>

        <h2
          id="eligibility"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">1.</span> Eligibility
        </h2>
        <p>
          You must be at least 13 years old (or the minimum age of digital
          consent in your country) to use the Service. If you are under 18, you
          must have permission from a parent or legal guardian.
        </p>

        <h2
          id="ownership"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">2.</span> Ownership of Content
        </h2>
        <p>
          All content generated through our Service, including but not limited
          to audio files, narrations, and other media created from text you
          provide (“User Content”), is owned by you, the user who created it.{" "}
          <strong>{SITE_NAME}</strong> makes no claim of ownership over User
          Content, and you retain all rights, title, and interest in and to the
          User Content, subject to these Terms.
        </p>
        <p>
          By creating User Content, you grant us a limited, non-exclusive
          license to process, store, and transmit such content solely as
          necessary to operate and improve the Service.
        </p>

        <h2
          id="ip-sharing"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">3.</span> Intellectual Property
          &amp; Sharing Restrictions
        </h2>
        <p>
          You are solely responsible for the text and materials you submit to
          the Service. By submitting text, you confirm that you have all
          necessary rights, licenses, and permissions to use such materials to
          generate User Content.
        </p>
        <Alert className="my-4">
          <PopcornIcon />
          <AlertTitle>Personal Use Only</AlertTitle>
          <AlertDescription>
            User Content is for your personal use only. You may not publish,
            share, distribute, sell, or otherwise make publicly available any
            User Content derived from text or materials for which you do not own
            the intellectual property rights or lack express authorization to
            use.
          </AlertDescription>
        </Alert>
        <p>
          Violation of this policy may result in suspension or termination of
          your account.
        </p>

        <h2
          id="acceptable-use"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">4.</span> Acceptable Use
        </h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Do not violate any law or third-party intellectual property rights.
          </li>
          <li>Do not upload or submit harmful, abusive, or illegal content.</li>
          <li>
            Do not reverse-engineer, interfere with, or disrupt the Service.
          </li>
          <li>
            Do not use the Service for commercial distribution of unlicensed or
            unauthorized works.
          </li>
        </ul>

        <h2
          id="our-ip"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">5.</span> Our Intellectual Property
        </h2>
        <p>
          The Service, including software, design, and technology, is owned by
          or licensed to <strong>{SITE_NAME}</strong> and is protected by
          copyright, trademark, and other intellectual property laws. Except for
          User Content, you may not copy, modify, or distribute any part of the
          Service without our written permission.
        </p>

        <h2
          id="availability"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">6.</span> Service Availability
          &amp; Changes
        </h2>
        <p>
          We may update, suspend, or discontinue the Service at any time without
          liability. We also reserve the right to introduce new features, modify
          pricing, or limit access to parts of the Service.
        </p>

        <h2
          id="disclaimers"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">7.</span> Disclaimers
        </h2>
        <Alert className="my-4">
          <CheckCircle2Icon />
          <AlertTitle>Disclaimer</AlertTitle>
          <AlertDescription>
            The Service is provided “as is” and “as available,” without
            warranties of any kind, express or implied, including but not
            limited to warranties of merchantability, fitness for a particular
            purpose, or non-infringement. We do not guarantee that User Content
            will be free of errors, interruptions, or delays.
          </AlertDescription>
        </Alert>

        <h2
          id="limitation"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">8.</span> Limitation of Liability
        </h2>
        <Alert variant="destructive" className="my-4">
          <AlertCircleIcon />
          <AlertTitle>Limitation of Liability</AlertTitle>
          <AlertDescription>
            To the fullest extent permitted by law, <strong>{SITE_NAME}</strong>{" "}
            will not be liable for any indirect, incidental, special, or
            consequential damages, including lost profits, data loss, or
            unauthorized use of User Content.
          </AlertDescription>
        </Alert>

        <h2
          id="termination"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">9.</span> Termination
        </h2>
        <p>
          We may suspend or terminate your access to the Service if you violate
          these Terms. Upon termination, your rights to use the Service will
          cease immediately, but you will retain ownership of your User Content
          (subject to Section 3).
        </p>

        <h2
          id="law"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">10.</span> Governing Law
        </h2>
        <p>
          These Terms are governed by and construed under the laws of{" "}
          {JURISDICTION}. Any disputes will be resolved exclusively in the
          courts of {JURISDICTION}.
        </p>

        <h2
          id="changes"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">11.</span> Changes to Terms
        </h2>
        <p>
          We may update these Terms from time to time. If we make significant
          changes, we will provide notice by posting the revised Terms on{" "}
          {SITE_NAME}. Continued use of the Service after changes take effect
          constitutes acceptance.
        </p>

        <h2
          id="contact"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">12.</span> Contact
        </h2>
        <address>
          <strong>{SITE_NAME}</strong>
          <br />
          <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          <br />
        </address>
      </article>
    </main>
  );
}
