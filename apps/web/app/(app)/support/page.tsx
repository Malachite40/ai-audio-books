import { FeedbackForm } from "@/components/feedback-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help or send feedback.",
};

export default function SupportPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <div className="max-w-md w-full mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-center">
          Support & Feedback
        </h1>
        <p className="mb-6 text-muted-foreground text-center">
          Need help or want to send feedback? Fill out the form below and our
          team will get back to you soon.
        </p>
        <FeedbackForm />
      </div>
    </div>
  );
}
