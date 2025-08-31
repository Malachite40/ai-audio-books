"use client";

import { Footer, FooterBottom } from "@workspace/ui/components/footer";
import { ModeToggle } from "@workspace/ui/components/mode-toggle";
import { cn } from "@workspace/ui/lib/utils";
import { Route } from "next";
import Link from "next/link";
import { ReactNode, useState } from "react";
import Logo from "./svgs/logo";

interface FooterLink {
  text: string;
  href: string;
}

interface FooterColumnProps {
  title: string;
  links: FooterLink[];
}

interface SocialLink {
  href: string;
  label: string;
  icon: ReactNode;
}

interface FooterProps {
  logo?: ReactNode;
  name?: string;
  columns?: FooterColumnProps[];
  /** If not provided, uses current year + siteConfig.name */
  copyright?: string;
  policies?: FooterLink[];
  socials?: SocialLink[];
  /** Show light/dark mode switch */
  showModeToggle?: boolean;
  /** Optional prominent call-to-action strip above the legal row */
  showCta?: boolean;
  className?: string;
}

/**
 * Heavily tailored defaults for instantaudio.online,
 * while remaining fully customizable via props.
 */
export default function FooterSection({
  logo = <Logo />,
  name = "instantaudio.online",
  columns = [
    {
      title: "Product",
      links: [
        { text: "Features", href: "/#features" },
        { text: "Pricing", href: "/pricing" },
        { text: "Changelog", href: "/changelog" },
        { text: "Docs", href: "/docs" },
      ],
    },
    {
      title: "For Creators",
      links: [
        { text: "Voice Library", href: "/voices" },
        { text: "Samples", href: "/samples" },
        { text: "Roadmap", href: "/roadmap" },
        { text: "Status", href: "/status" },
      ],
    },
    {
      title: "Company",
      links: [
        { text: "About", href: "/about" },
        { text: "Blog", href: "/blog" },
        { text: "Contact", href: "/contact" },
      ],
    },
  ],
  policies = [
    { text: "Privacy Policy", href: "/privacy" },
    { text: "Terms of Service", href: "/term" },
  ],
  socials = [
    // You can pass your own icons/names here from lucide-react or custom SVGs
    // Example (uncomment and adjust to taste):
    // { href: siteConfig?.links?.twitter ?? "https://x.com", label: "Twitter", icon: <Twitter className="h-4 w-4" /> },
  ],
  showModeToggle = true,
  showCta = true,
  className,
}: FooterProps) {
  const [date, setDate] = useState(new Date());
  const copyright = `© ${date.getFullYear()} ${name}. All rights reserved.`;
  return (
    <footer className={cn("bg-background w-full px-4", className)}>
      <div className="max-w-container mx-auto">
        <Footer>
          {/* Brand & Columns
          <FooterContent>
            <FooterColumn className="col-span-2 sm:col-span-3 md:col-span-1">
              <div className="flex items-center gap-2">
                {logo}
                <h3 className="text-xl font-bold tracking-tight">{name}</h3>
              </div>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                Turn text into bingeable audio. Create instant audiobooks with
                chaptering, stitching, and a hosted player — all in one place.
              </p>
            </FooterColumn>

            {columns.map((column, index) => (
              <FooterColumn key={index}>
                <h3 className="text-md pt-1 font-semibold">{column.title}</h3>
                {column.links.map((link, linkIndex) => (
                  <SmartLink key={linkIndex} href={link.href}>
                    <span className="text-sm">{link.text}</span>
                  </SmartLink>
                ))}
              </FooterColumn>
            ))}
          </FooterContent> */}

          {/* Bottom Row */}
          <FooterBottom>
            <div className="text-sm">{copyright}</div>

            <div className="flex items-center gap-4">
              {policies.map((policy, index) => (
                <SmartLink key={index} href={policy.href}>
                  {policy.text}
                </SmartLink>
              ))}

              {socials?.length ? (
                <div className="mx-2 h-4 w-px bg-border" aria-hidden />
              ) : null}

              {socials?.map((s, i) => (
                <SmartLink
                  key={i}
                  href={s.href}
                  className="inline-flex items-center gap-1 text-sm"
                  aria-label={s.label}
                  title={s.label}
                >
                  {s.icon}
                  <span className="sr-only">{s.label}</span>
                </SmartLink>
              ))}

              {showModeToggle && <ModeToggle />}
            </div>
          </FooterBottom>
        </Footer>
      </div>
    </footer>
  );
}

/** Picks Next <Link> for internal URLs and <a> for external URLs */
function SmartLink({
  href,
  children,
  className,
  ...rest
}: React.PropsWithChildren<{
  href: string;
  className?: string;
}> &
  React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const isInternal = /^\/?(?!http|mailto:|tel:)/.test(href);

  const base = (
    <span
      className={cn("text-muted-foreground hover:text-foreground", className)}
    >
      {children}
    </span>
  );

  return isInternal ? (
    <Link
      href={href as Route}
      {...rest}
      className={cn("inline-flex items-center")}
    >
      {base}
    </Link>
  ) : (
    <a
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      {...rest}
      className={cn("inline-flex items-center")}
    >
      {base}
    </a>
  );
}
