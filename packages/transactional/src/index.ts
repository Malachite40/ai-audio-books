export { render } from "@react-email/components";

// Re-export all email templates
export { WelcomeEmail } from "../emails/welcome";
export { TransactionConfirmation } from "../emails/transaction-confirmation";
export { PasswordReset } from "../emails/password-reset";
export { Unsubscribe } from "../emails/unsubscribe";
export { PriceAlerts } from "../emails/price-alerts";
export { BidPlaced } from "../emails/bid-placed";
export { PurchaseCompleted } from "../emails/purchase-completed";
export { RewardsBalance } from "../emails/rewards-balance";

// Export shared styles and components for creating new templates
export * from "./styles";
export * from "./components";
