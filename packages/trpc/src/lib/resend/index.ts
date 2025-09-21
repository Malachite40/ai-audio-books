import { Resend } from "resend";
import { env } from "../../env";

// Cast global to a specific type that includes your new Resend variable
const globalForResend = global as unknown as { resend: Resend };

// Initialize the global Resend variable
export const resend = new Resend(env.RESEND_API_KEY);

// Assign the Resend instance to the global object if not in production
if (process.env.NODE_ENV !== "production") globalForResend.resend = resend;
