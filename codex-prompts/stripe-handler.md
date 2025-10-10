Add or update a Stripe webhook event handler.

Arguments:
- Event type: `$1` (exact Stripe event string, e.g., `checkout.session.completed`)
- Handler goal: `$2` (what to update in DB or side effects)

Do:
1) File naming: use the exact event type as filename under the Stripe handler module (per project conventions). Example filenames: `checkout.session.completed.ts`, `invoice.paid.ts`, `payment_intent.succeeded.ts`, `customer.subscription.deleted.ts`.
2) Export a function named `handle<EventCamelCase>` that receives the specific typed `Stripe.<EventName>Event`.
3) Implement `$2` using `ctx.db` and any relevant Stripe calls as needed.
4) Register it in the central switch: add a `case "$1"` in `handler.ts` that calls your new function.

Notes:
- Follow the conventions described in AGENT_README.
- Keep logic cohesive and minimal in each handler.

