"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { cn } from "@workspace/ui/lib/utils";
import { ReactNode } from "react";

export type FaqItem = {
  question: string;
  answer: ReactNode;
  value?: string;
};

type FaqSectionProps = {
  faqs: FaqItem[];
  title?: string;
  description?: ReactNode;
  className?: string;
  accordionType?: "single" | "multiple";
};

/**
 * Reusable FAQ section with configurable title/description and Accordions.
 */
export function FaqSection({
  faqs,
  title = "Frequently Asked Questions",
  description,
  className,
  accordionType = "multiple",
}: FaqSectionProps) {
  return (
    <section className={cn("min-h-dvh w-full", className)}>
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-2 text-2xl font-bold">{title}</h2>
        {description ? (
          <p className="mb-6 min-w-0 text-sm leading-relaxed text-foreground/70 break-words [overflow-wrap:anywhere]">
            {description}
          </p>
        ) : null}

        <Accordion type={accordionType} className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={faq.value ?? faq.question}
              value={faq.value ?? `faq-${index}`}
            >
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export default FaqSection;
