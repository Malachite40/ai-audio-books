import { Heading, Hr, Section, Text } from "@react-email/components";
import { EmailButton, EmailLayout, InfoBox } from "../src/components";
import { components, typography } from "../src/styles";

interface ReferralBonusEmailProps {
  referredEmail: string;
  bonus: number;
  total?: number;
}

const baseUrl = process.env.FRONTEND_URL || "https://instantaudio.online/";

export const ReferralBonusEmail = ({
  referredEmail,
  bonus,
  total,
}: ReferralBonusEmailProps) => {
  return (
    <EmailLayout preview="You earned 100,000 credits—thanks for referring!">
      <Heading style={typography.h1}>
        You earned {bonus.toLocaleString()} credits 🎉
      </Heading>
      <Text style={typography.body}>
        Thanks for referring a friend! A user you referred just became a paid
        customer.
      </Text>
      <InfoBox variant="highlight">
        <Text style={typography.body}>Referred user: {referredEmail}</Text>
        {typeof total === "number" && (
          <Text style={typography.body}>
            Your total referral bonus credits: {total.toLocaleString()}
          </Text>
        )}
      </InfoBox>
      <Section style={{ textAlign: "center" }}>
        <EmailButton href={`${baseUrl}`}>Go to your dashboard</EmailButton>
      </Section>
      <Hr style={components.divider.default} />
    </EmailLayout>
  );
};

ReferralBonusEmail.PreviewProps = {
  referredEmail: "dylancronkhite1@gmail.com",
  bonus: 100000,
  total: 300000,
} as ReferralBonusEmailProps;

export default ReferralBonusEmail;
