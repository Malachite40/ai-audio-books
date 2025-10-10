export { render } from "@react-email/components";

// Re-export all email templates
// Export default as named to guarantee a callable function shape across bundlers
export { default as ReferralBonusEmail } from "../emails/referral-bonus";
export { default as WelcomeEmail } from "../emails/welcome";

// Export shared styles and components for creating new templates
export * from "./components";
export * from "./styles";
