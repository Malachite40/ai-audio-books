import { Heading, Hr, Preview, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailButton, EmailLayout, InfoBox } from "../src/components";
import { colors, components, typography, utils } from "../src/styles";

interface WelcomeEmailProps {
  username?: string;
}

const baseUrl = process.env.FRONTEND_URL || "https://instantaudio.online/";

export const WelcomeEmail = ({ username = "there" }: WelcomeEmailProps) => {
  return (
    <>
      <EmailLayout preview="Welcome to InstantAudio.online - Your AI Audiobook Platform">
        <Preview>
          Welcome to InstantAudio.online - Your AI Audiobook Platform
        </Preview>

        <Heading style={typography.h1}>Welcome to InstantAudio.online!</Heading>
        <Text style={typography.heroText}>
          Hi {username}, we're excited to help you turn text into beautiful
          audiobooks.
        </Text>

        <Text style={typography.body}>
          You now have access to the fastest, easiest way to create polished
          audiobooks from any long-form text. Paste your book, pick a voice, and
          let our AI do the rest!
        </Text>

        <InfoBox variant="highlight">
          <Text
            style={{
              ...typography.body,
              color: colors.text.primary,
              fontWeight: "bold",
              margin: "0 0 10px",
            }}
          >
            Get started in minutes:
          </Text>
          <Text
            style={{
              ...typography.small,
              textAlign: "left" as const,
              margin: 0,
            }}
          >
            • Paste or upload your text
            <br />
            • Choose a voice and preview
            <br />
            • Render and download your audiobook (MP3)
            <br />• Share a link or keep it private
          </Text>
        </InfoBox>

        <Section style={utils.btnContainer}>
          <EmailButton href={`${baseUrl}`}>
            Go to InstantAudio.online
          </EmailButton>
        </Section>

        <Hr style={components.divider.default} />
      </EmailLayout>
    </>
  );
};

WelcomeEmail.PreviewProps = {
  username: "John Doe",
} as WelcomeEmailProps;

export default WelcomeEmail;
