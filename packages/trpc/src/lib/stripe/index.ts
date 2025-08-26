// Import the Stripe library
import Stripe from "stripe";

// Cast global to a specific type that includes your new Stripe variable
const globalForStripe = global as unknown as { stripe: Stripe };

// Initialize the global Stripe variable
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-07-30.basil",
});

// Assign the Stripe instance to the global object if not in production
if (process.env.NODE_ENV !== "production") globalForStripe.stripe = stripe;
