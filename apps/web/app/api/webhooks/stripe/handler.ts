import Stripe from "stripe";
import { handleCustomerSubscriptionDelete } from "./customer.subscription.deleted";
import { handleInvoicePaid } from "./invoice.paid";
import { handlePaymentIntentSucceeded } from "./payment_intent.succeeded";

export async function handleStripeEvent(event: Stripe.Event) {
  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded":
      await handlePaymentIntentSucceeded(event);
      break;
    case "invoice.paid":
      await handleInvoicePaid(event);
      break;
    case "customer.subscription.deleted":
      await handleCustomerSubscriptionDelete(event);
      break;
    default:
      // Unexpected event type
      console.log(`Unhandled event type ${event.type}.`);
  }
}
