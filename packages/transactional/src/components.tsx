import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Link,
  Section,
  Text,
} from "@react-email/components";
import "dotenv/config";
import * as React from "react";
import { colors, components, dataDisplay, layout, typography } from "./styles";

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export const EmailLayout = ({ preview, children }: EmailLayoutProps) => {
  const baseUrl = process.env.FRONTEND_URL || "https://instantaudio.online";
  return (
    <Html>
      <Head />
      <Body style={layout.main}>
        <Container style={layout.container}>
          <Section style={layout.logoContainer}>
            <Img
              src={`${baseUrl}/logo-primary.png`}
              width="110"
              height="80"
              alt="InstantAudio.online"
              style={layout.logo}
            />
          </Section>
          {children}
          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
};

interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  style?: React.CSSProperties;
}

export const EmailButton = ({
  href,
  children,
  variant = "primary",
  style,
}: EmailButtonProps) => {
  function getButtonStyle() {
    if (variant === "primary") return components.button.primary;
    if (variant === "secondary") return components.button.secondary;
    if (variant === "ghost") return components.button.ghost;
    return components.button.primary;
  }

  return (
    <Button
      style={{
        ...getButtonStyle(),
        ...style,
      }}
      href={href}
    >
      {children}
    </Button>
  );
};

interface EmailFooterProps {
  showSupport?: boolean;
  customText?: React.ReactNode;
}

export const EmailFooter = ({
  showSupport = true,
  customText,
}: EmailFooterProps) => (
  <>
    {customText}
    {showSupport && (
      <Text style={typography.footer}>
        Need help? Contact us at{" "}
        <Link href="mailto:support@instantaudio.online" style={components.link}>
          support@instantaudio.online
        </Link>
      </Text>
    )}
    <Text style={typography.footer}>
      InstantAudio.online | AI Audiobook Platform
    </Text>
  </>
);

interface InfoBoxProps {
  children: React.ReactNode;
  variant?: "default" | "info" | "highlight" | "gradient";
}

export const InfoBox = ({ children, variant = "default" }: InfoBoxProps) => (
  <Section style={components.box[variant]}>{children}</Section>
);

interface DataRowProps {
  label: string;
  value: string | React.ReactNode;
  isTotal?: boolean;
}

export const DataRow = ({ label, value, isTotal = false }: DataRowProps) => {
  return (
    <div style={dataDisplay.row}>
      <div style={{ display: "table", width: "100%" }}>
        <div style={{ display: "table-row" }}>
          <div
            style={{
              display: "table-cell",
              ...(isTotal ? dataDisplay.totalLabel : dataDisplay.label),
            }}
          >
            {label}
          </div>
          <div
            style={{
              display: "table-cell",
              ...(isTotal ? dataDisplay.totalValue : dataDisplay.value),
            }}
          >
            {value}
          </div>
        </div>
      </div>
    </div>
  );
};

interface IconHeaderProps {
  icon: string;
  title: string;
  size?: "small" | "medium" | "large";
}

export const IconHeader = ({
  icon,
  title,
  size = "large",
}: IconHeaderProps) => (
  <Section style={{ textAlign: "center" as const }}>
    <Text style={components.icon[size]}>{icon}</Text>
    <Text style={typography.h1}>{title}</Text>
  </Section>
);

interface AlertBannerProps {
  children: React.ReactNode;
  type?: "info" | "success" | "warning" | "error";
}

export const AlertBanner = ({ children, type = "info" }: AlertBannerProps) => {
  const backgroundColor = colors.background[type];
  const textColor = {
    info: "#004085",
    success: "#155724",
    warning: "#856404",
    error: "#721c24",
  }[type];

  return (
    <Section
      style={{
        background: backgroundColor,
        borderRadius: "4px",
        margin: "30px auto",
        padding: "16px",
        maxWidth: "450px",
      }}
    >
      <Text
        style={{
          color: textColor,
          fontFamily: typography.fontFamily,
          fontSize: "14px",
          lineHeight: "20px",
          margin: "0",
          textAlign: "center" as const,
        }}
      >
        {children}
      </Text>
    </Section>
  );
};

interface ImageBoxProps {
  src: string;
  alt: string;
  title: string;
  width?: number;
  height?: number;
}

export const ImageBox = ({
  src,
  alt,
  title,
  width = 80,
  height = 80,
}: ImageBoxProps) => (
  <>
    <Img
      src={src}
      width={width}
      height={height}
      alt={alt}
      style={{
        borderRadius: "8px",
        margin: "0 auto",
      }}
    />
    <Text
      style={{
        ...typography.h2,
        margin: "16px 0",
      }}
    >
      {title}
    </Text>
  </>
);
