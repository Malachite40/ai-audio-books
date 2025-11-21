import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { AlertTriangleIcon, Globe2Icon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";

const SITE_NAME = "InstantAudio.online";
const LAST_UPDATED = "2025-09-18"; // YYYY-MM-DD
const CONTACT_EMAIL = "support@instantaudio.online"; // <-- update if needed

export const metadata: Metadata = {
  title: `Privacy Policy — ${SITE_NAME}`,
  description:
    "Privacy Policy for Instantaudio.online describing what we collect, how we use it, and your choices.",
  alternates: { canonical: "https://instantaudio.online/privacy" },
  robots: { index: true, follow: true },
  openGraph: {
    title: `Privacy Policy — ${SITE_NAME}`,
    description:
      "Learn how Instantaudio.online collects, uses, and protects your information, plus your privacy choices.",
    url: "https://instantaudio.online/privacy",
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Privacy Policy — ${SITE_NAME}`,
    description:
      "Instantaudio.online Privacy Policy: data we collect, how we use it, and your rights.",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Privacy Policy
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
            <a href="#information" className="hover:underline">
              Information We Collect
            </a>
          </li>
          <li>
            <a href="#use" className="hover:underline">
              How We Use Information
            </a>
          </li>
          <li>
            <a href="#cookies" className="hover:underline">
              Cookies &amp; Tracking
            </a>
          </li>
          <li>
            <a href="#sharing" className="hover:underline">
              Sharing &amp; Disclosures
            </a>
          </li>
          <li>
            <a href="#security" className="hover:underline">
              Data Security
            </a>
          </li>
          <li>
            <a href="#retention" className="hover:underline">
              Data Retention
            </a>
          </li>
          <li>
            <a href="#rights" className="hover:underline">
              Your Choices &amp; Rights
            </a>
          </li>
          <li>
            <a href="#children" className="hover:underline">
              Children’s Privacy
            </a>
          </li>
          <li>
            <a href="#transfers" className="hover:underline">
              International Transfers
            </a>
          </li>
          <li>
            <a href="#third-parties" className="hover:underline">
              Third-Party Links &amp; Services
            </a>
          </li>
          <li>
            <a href="#changes" className="hover:underline">
              Changes to This Policy
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
          This Privacy Policy explains how <strong>{SITE_NAME}</strong> (“we,”
          “our,” or “us”) collects, uses, and protects your information when you
          use our text-to-speech audiobook service (“Service”). By accessing or
          using the Service, you agree to this Policy.
        </p>

        <h2
          id="information"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">1.</span> Information We Collect
        </h2>
        <p>We collect the following categories of information:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Account data: name, email, authentication details, and preferences.
          </li>
          <li>
            Usage data: interactions with the Service, device information,
            cookie identifiers, and rough location inferred from IP.
          </li>
          <li>
            Content data: text you submit, generated audio, and related metadata
            needed to provide the Service.
          </li>
          <li>Support data: messages and attachments you send to us.</li>
        </ul>

        <h2
          id="use"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">2.</span> How We Use Information
        </h2>
        <p>We use your information to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Deliver, maintain, and improve the Service and its features.</li>
          <li>Process text submissions into audio and store related files.</li>
          <li>Prevent abuse, secure accounts, and enforce our Terms.</li>
          <li>Communicate about updates, billing, and support.</li>
          <li>Analyze aggregate usage to improve performance and quality.</li>
        </ul>

        <h2
          id="cookies"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">3.</span> Cookies &amp; Tracking
        </h2>
        <p>
          We use cookies and similar technologies to keep you signed in,
          remember preferences, and understand usage. You can adjust browser
          settings to limit cookies, but the Service may not function correctly
          without them.
        </p>

        <h2
          id="sharing"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">4.</span> Sharing &amp; Disclosures
        </h2>
        <p>
          We do not sell your personal information. We may share limited data:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Service providers that help us operate the Service (e.g., hosting,
            storage, customer support).
          </li>
          <li>Analytics and error monitoring providers.</li>
          <li>
            Legal or safety requirements, such as responding to lawful requests
            or protecting our rights and users.
          </li>
          <li>
            Business transfers in connection with a merger, acquisition, or sale
            of assets, with notice where required.
          </li>
        </ul>

        <Alert className="my-4">
          <ShieldCheckIcon />
          <AlertTitle>Content Privacy</AlertTitle>
          <AlertDescription>
            Text you submit and the audio we generate are used only to deliver
            the Service, improve quality, and comply with applicable law. We do
            not publish or sell your content.
          </AlertDescription>
        </Alert>

        <h2
          id="security"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">5.</span> Data Security
        </h2>
        <p>
          We implement technical and organizational measures to protect your
          information, including encryption in transit and access controls. No
          security practice is perfect; please use unique, strong passwords and
          keep your credentials safe.
        </p>

        {/* <Alert variant="default" className="my-4">
          <LockIcon />
          <AlertTitle>Two-Factor Tips</AlertTitle>
          <AlertDescription>
            Where available, enable multi-factor authentication on accounts used
            with {SITE_NAME} for better protection.
          </AlertDescription>
        </Alert> */}

        <h2
          id="retention"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">6.</span> Data Retention
        </h2>
        <p>
          We retain information only as long as necessary to provide the
          Service, fulfill legal obligations, resolve disputes, and enforce our
          agreements. When data is no longer needed, we delete or anonymize it.
        </p>

        <h2
          id="rights"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">7.</span> Your Choices &amp; Rights
        </h2>
        <p>
          Depending on your location, you may have rights to access, correct,
          delete, or restrict certain uses of your information. You can:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Update account details in your profile settings.</li>
          <li>Request deletion of your account and associated data.</li>
          <li>Opt out of non-essential communications.</li>
          <li>Adjust cookie preferences through your browser.</li>
        </ul>
        <p>
          To exercise rights or ask questions, contact us at{" "}
          <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>

        <h2
          id="children"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">8.</span> Children’s Privacy
        </h2>
        <p>
          The Service is not directed to children under 13 (or the age of
          digital consent in your region). We do not knowingly collect personal
          information from children. If you believe a child provided data,
          contact us to request deletion.
        </p>

        <h2
          id="transfers"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">9.</span> International Transfers
        </h2>
        <p>
          We may process information on servers located in the United States and
          other countries. By using the Service, you consent to the transfer of
          your information to locations that may have different data protection
          laws than your region.
        </p>
        <Alert className="my-4">
          <Globe2Icon />
          <AlertTitle>Cross-Border Safeguards</AlertTitle>
          <AlertDescription>
            When transferring data across regions, we use appropriate safeguards
            such as contractual commitments and service-provider diligence.
          </AlertDescription>
        </Alert>

        <h2
          id="third-parties"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">10.</span> Third-Party Links &amp;
          Services
        </h2>
        <p>
          The Service may link to external sites or integrations we do not
          control. Your use of those services is subject to their privacy
          policies. We are not responsible for the privacy practices of third
          parties.
        </p>

        <h2
          id="changes"
          className="mt-10 mb-2 text-xl font-bold flex items-center gap-2"
        >
          <span className="text-neutral-400">11.</span> Changes to This Policy
        </h2>
        <p>
          We may update this Privacy Policy periodically. Material changes will
          be posted on {SITE_NAME}. Continued use of the Service after changes
          become effective means you accept the updated Policy.
        </p>

        <Alert variant="destructive" className="my-4">
          <AlertTriangleIcon />
          <AlertTitle>Policy Updates</AlertTitle>
          <AlertDescription>
            If you disagree with an updated Policy, please stop using the
            Service and contact us regarding your data options.
          </AlertDescription>
        </Alert>

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
