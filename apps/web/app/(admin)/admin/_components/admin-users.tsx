"use client";

import { PaginationBar } from "@/components/pagination-bar";
import { ResponsiveModal } from "@/components/resonpsive-modal";
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import {
  Check,
  Loader,
  Loader2,
  MoreHorizontal,
  RefreshCcw,
  Shield,
  UserX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Badge } from "@workspace/ui/components/badge";
import { Skeleton } from "@workspace/ui/components/skeleton";

const PAGE_SIZE = 20;
const ROLES = ["user", "admin"] as const;
const PLANS = ["FREE", "BASIC", "PRO"] as const;

export function AdminUsersCard() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"ALL" | (typeof ROLES)[number]>("ALL");
  const [banned, setBanned] = useState<"ALL" | "YES" | "NO">("ALL");
  const [plan, setPlan] = useState<"ALL" | (typeof PLANS)[number]>("ALL");
  const [page, setPage] = useState(1);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustUserId, setAdjustUserId] = useState<string | null>(null);
  const [adjustUserCredits, setAdjustUserCredits] = useState<number>(0);

  const { data, isLoading, refetch, isFetching } = api.users.adminList.useQuery(
    {
      page,
      pageSize: PAGE_SIZE,
      q: q.trim() ? q.trim() : undefined,
      role: role === "ALL" ? undefined : (role as any),
      banned: banned === "ALL" ? undefined : banned === "YES",
      plan: plan === "ALL" ? undefined : (plan as any),
    }
  );

  const rows = useMemo(() => data?.users ?? [], [data]);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE)),
    [data?.total]
  );

  // Debounce search updates to reduce requests
  useEffect(() => {
    const t = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [q, role, banned, plan]);

  const total = data?.total ?? 0;
  const startIdx = (page - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(total, page * PAGE_SIZE);

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-2 mb-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Users</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <RefreshCcw className="size-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search name/email/id"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[240px]"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Role</span>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Banned</span>
            <Select value={banned} onValueChange={(v) => setBanned(v as any)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="YES">Yes</SelectItem>
                <SelectItem value="NO">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Plan</span>
            <Select value={plan} onValueChange={(v) => setPlan(v as any)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {PLANS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(search || role !== "ALL" || banned !== "ALL" || plan !== "ALL") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setQ("");
                setRole("ALL");
                setBanned("ALL");
                setPlan("ALL");
              }}
            >
              <X className="size-4 mr-1" /> Clear filters
            </Button>
          )}
        </div>
        {(q || role !== "ALL" || banned !== "ALL" || plan !== "ALL") && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {q && (
              <Badge variant="secondary" className="px-2 py-0.5">
                Search: {q}
              </Badge>
            )}
            {role !== "ALL" && (
              <Badge variant="secondary" className="px-2 py-0.5">
                Role: {role}
              </Badge>
            )}
            {banned !== "ALL" && (
              <Badge
                variant={banned === "YES" ? "destructive" : "secondary"}
                className="px-2 py-0.5"
              >
                {banned === "YES" ? "Banned" : "Not Banned"}
              </Badge>
            )}
            {plan !== "ALL" && (
              <Badge variant="secondary" className="px-2 py-0.5">
                Plan: {plan}
              </Badge>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {isLoading
                ? "Loading…"
                : `Showing ${startIdx}-${endIdx} of ${total}`}
            </span>
          </div>
        )}
      </div>
      <Table>
        <TableCaption>All users.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Banned</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Credits</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`sk-${i}`}>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-56" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-8 w-8 ml-auto" />
                </TableCell>
              </TableRow>
            ))}

          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8">
                No users found.
              </TableCell>
            </TableRow>
          )}

          {rows.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="max-w-[220px] whitespace-nowrap overflow-hidden text-ellipsis">
                <Link href={`/admin/users/${u.id}`} className="hover:underline">
                  {u.name || u.id}
                </Link>
              </TableCell>
              <TableCell className="max-w-[240px] whitespace-nowrap overflow-hidden text-ellipsis">
                {u.email}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="uppercase">
                  {(u.role as any) || "user"}
                </Badge>
              </TableCell>
              <TableCell>
                {u.banned ? (
                  <Badge variant="destructive">Banned</Badge>
                ) : (
                  <Badge variant="secondary">Active</Badge>
                )}
              </TableCell>
              <TableCell>
                {u.Subscription?.plan ? (
                  <Badge variant="secondary" className="uppercase">
                    {u.Subscription.plan}
                  </Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="px-1 font-mono transition-colors hover:underline hover:text-primary"
                        onClick={() => {
                          setAdjustUserId(u.id);
                          setAdjustUserCredits(u.Credits?.amount ?? 0);
                          setAdjustOpen(true);
                        }}
                        aria-label="Adjust credits"
                      >
                        {(u.Credits?.amount ?? 0).toLocaleString()}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Adjust credits</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
              <TableCell>
                {u.createdAt instanceof Date
                  ? u.createdAt.toLocaleString()
                  : new Date((u as any).createdAt).toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <UserAdminActions
                    userId={u.id}
                    role={(u.role as any) || "user"}
                    banned={!!u.banned}
                    disabled={isFetching || isLoading}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {isFetching && !isLoading && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-4">
                <Loader className="animate-spin size-4 mx-auto" />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {adjustUserId && (
        <AdjustCreditsModal
          open={adjustOpen}
          onOpenChange={(v) => setAdjustOpen(v)}
          userId={adjustUserId}
          currentCredits={adjustUserCredits}
        />
      )}
      <div className="mt-4">
        <PaginationBar
          page={page}
          totalPages={totalPages}
          pages={Array.from({ length: totalPages }, (_, i) => i + 1)}
          showLeftEllipsis={page > 3}
          showRightEllipsis={page < totalPages - 2}
          setPage={setPage}
        />
      </div>
    </Card>
  );
}

function UserAdminActions({
  userId,
  role,
  banned,
  disabled,
}: {
  userId: string;
  role: "user" | "admin" | string;
  banned: boolean;
  disabled?: boolean;
}) {
  const utils = api.useUtils();
  const setRole = api.users.adminSetRole.useMutation({
    onSuccess: async () => {
      await utils.users.adminList.invalidate();
    },
  });
  const setBanned = api.users.adminSetBanned.useMutation({
    onSuccess: async () => {
      await utils.users.adminList.invalidate();
    },
  });
  const busy = setRole.isPending || setBanned.isPending;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          aria-label="User actions"
          disabled={disabled || busy}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MoreHorizontal className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/admin/users/${userId}`}>View</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async (e) => {
            e.preventDefault();
            await setRole
              .mutateAsync({ userId, role: "admin" })
              .catch(console.error);
          }}
        >
          <Shield className="size-4 mr-2" /> Make Admin
          {role === "admin" && <Check className="size-4 ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async (e) => {
            e.preventDefault();
            await setRole
              .mutateAsync({ userId, role: "user" })
              .catch(console.error);
          }}
        >
          <Shield className="size-4 mr-2" /> Make User
          {role === "user" && <Check className="size-4 ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {banned ? (
          <DropdownMenuItem
            onSelect={async (e) => {
              e.preventDefault();
              await setBanned
                .mutateAsync({ userId, banned: false })
                .catch(console.error);
            }}
          >
            <UserX className="size-4 mr-2" /> Unban User
          </DropdownMenuItem>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem className="text-destructive focus:text-destructive">
                <UserX className="size-4 mr-2" /> Ban User
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ban this user?</AlertDialogTitle>
                <AlertDialogDescription>
                  This immediately prevents the user from accessing the
                  platform. You can undo this later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    await setBanned
                      .mutateAsync({ userId, banned: true })
                      .catch(console.error);
                  }}
                >
                  Confirm Ban
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const AdjustSchema = z.object({
  delta: z
    .number({ invalid_type_error: "Enter a number" })
    .int("Must be an integer")
    .min(-1_000_000_000)
    .max(1_000_000_000),
  description: z.string().max(500).optional(),
});

type AdjustValues = z.infer<typeof AdjustSchema>;

function AdjustCreditsModal({
  open,
  onOpenChange,
  userId,
  currentCredits,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  currentCredits: number;
}) {
  const utils = api.useUtils();
  const form = useForm<AdjustValues>({
    resolver: zodResolver(AdjustSchema),
    mode: "onChange",
    defaultValues: { delta: 0, description: "" },
  });
  const adjust = api.users.adminAdjustCredits.useMutation({
    onSuccess: async () => {
      await utils.users.adminList.invalidate();
      form.reset({ delta: 0, description: "" });
      onOpenChange(false);
    },
  });

  const delta = form.watch("delta") ?? 0;
  const MAX_BAL = 100_000_000;
  const projected = Math.max(
    0,
    Math.min(
      MAX_BAL,
      (currentCredits ?? 0) + (Number.isFinite(delta) ? delta : 0)
    )
  );
  const applied = projected - (currentCredits ?? 0);

  // Pricing: $1 per 100k chars (see pricing table)
  const dollars = (Math.abs(applied) / 100_000) * 1.0;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(v) => {
        if (!v) form.reset({ delta: 0, description: "" });
        onOpenChange(v);
      }}
      title="Adjust Credits"
      description="Add or remove credits; capped at 100,000,000 and never below zero."
    >
      <Form {...form}>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (vals) => {
            await adjust.mutateAsync({
              userId,
              delta: vals.delta,
              description: vals.description,
            });
          })}
        >
          <FormField
            control={form.control}
            name="delta"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Delta (tokens)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1"
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="text-sm text-muted-foreground -mt-2">
            Positive adds, negative subtracts. Est. $ equivalent updates live.
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Note (optional)</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder="Reason for adjustment"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="text-sm space-y-1">
            <div>
              Current:{" "}
              <span className="font-mono">
                {currentCredits.toLocaleString()}
              </span>
            </div>
            <div>
              Applied:{" "}
              <span className="font-mono">{applied.toLocaleString()}</span>
            </div>
            <div>
              New Balance:{" "}
              <span className="font-mono">{projected.toLocaleString()}</span>{" "}
              (cap 100,000,000)
            </div>
            <div>
              Est. $ equivalent:{" "}
              <span className="font-mono">${dollars.toFixed(2)}</span> (@ $1 per
              100k)
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={adjust.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={!form.formState.isValid || adjust.isPending}
            >
              {adjust.isPending ? "Saving..." : "Apply"}
            </Button>
          </div>
        </form>
      </Form>
    </ResponsiveModal>
  );
}
