import Stripe from "stripe";
import { handleChargeRefunded } from "./charge.refunded";
import { handleCheckoutSessionCompleted } from "./checkout.session.completed";
import { handleCustomerSubscriptionCreated } from "./customer.subscription.created";
import { handleCustomerSubscriptionDelete } from "./customer.subscription.deleted";
import { handleInvoicePaid } from "./invoice.paid";
import { handlePaymentIntentSucceeded } from "./payment_intent.succeeded";

export async function handleStripeEvent(event: Stripe.Event) {
  console.log(`Received event: ${event.type}`);
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
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(event);
      break;
    case "charge.refunded":
      await handleChargeRefunded(event);
      break;
    case "customer.subscription.created":
      await handleCustomerSubscriptionCreated(event);
    default:
      // Unexpected event type
      console.log(`Unhandled event type ${event.type}.`);
  }
}
