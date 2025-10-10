import { Heading, Hr, Section, Text } from "@react-email/components";
import { EmailButton, EmailLayout, InfoBox } from "../src/components";
import { components, typography, utils } from "../src/styles";

interface SubscriptionActivatedEmailProps {
  username?: string;
}

const baseUrl = process.env.FRONTEND_URL || "https://instantaudio.online";

export const SubscriptionActivatedEmail =
  ({}: SubscriptionActivatedEmailProps) => {
    return (
      <EmailLayout preview="Your subscription is active — let’s create!">
        <Heading style={typography.h1}>
          Congrats — you're now subscribed!
        </Heading>

        <Text style={typography.heroText}>
          Your subscription is active. You're all set to start creating
          audiobooks with premium speed and capacity.
        </Text>

        <InfoBox>
          <Text style={typography.body}>
            Jump right in by creating a new audio file. Paste your text, choose
            a voice, preview, and render — it’s that simple.
          </Text>
        </InfoBox>

        <Section style={utils.btnContainer}>
          <EmailButton href={`${baseUrl}/audio-file/new`}>
            Create your first audiobook
          </EmailButton>
        </Section>

        <Hr style={components.divider.default} />
      </EmailLayout>
    );
  };

SubscriptionActivatedEmail.PreviewProps = {} as SubscriptionActivatedEmailProps;

export default SubscriptionActivatedEmail;
