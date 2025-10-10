Add a transactional email template and wire it for sending.

Arguments:
- Template name (PascalCase component + kebab file): `$1` (e.g., `WelcomeEmail` / `welcome`)
- Props shape (Zod-like description or TS): `$2`
- Subject: `$3`
- Send location (router/context path): `$4`

Do:
1) Create `packages/transactional/emails/$1.tsx` (or `$1` in kebab as appropriate) using `@react-email/components` and shared layout/styles:
   - Components: `packages/transactional/src/components.tsx`
   - Styles: `packages/transactional/src/styles.ts`
   - Export default component `<$1 {...props} />`.
2) Export it from `packages/transactional/src/index.ts`.
3) Send via Resend in `$4` using:
   ```ts
   import { $1 } from "@/packages/transactional";
   await resend.emails.send({
     from: /* from */, to: /* to */, subject: "$3",
     react: <$1 {...props} />,
   });
   ```
4) Ensure `process.env.FRONTEND_URL` is set for asset URLs in `EmailLayout`.

Notes:
- Example template: `packages/transactional/emails/welcome.tsx`.
- Example send sites: `packages/trpc/src/context.ts`, `packages/trpc/src/routers/emails.ts`.

