Add a React Hook Form + Zod form wired to a tRPC mutation.

Arguments:
- Component path: `$1` (e.g., `apps/web/components/feedback-form.tsx`)
- Zod schema fields: `$2` (e.g., `{ email?: string.email(), message: string.min(1) }`)
- tRPC mutation path: `$3` (e.g., `support.submit`)
- Default values: `$4` (optional)

Do:
1) Define Zod schema in `$1` and infer types. Example:
   ```ts
   const Schema = z.object($2);
   type Values = z.infer<typeof Schema>;
   ```
2) Initialize form:
   ```ts
   const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: $4, mode: "onChange" });
   ```
3) Wire tRPC:
   ```ts
   const save = api.$3.useMutation();
   <Form {...form}>
     <form onSubmit={form.handleSubmit((v) => save.mutate(v))}> ... </form>
   </Form>
   ```
4) Use shadcn form primitives: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormMessage`.

Notes:
- Example: `apps/web/components/feedback-form.tsx`.

