"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { Input } from "@workspace/ui/components/input";
import { Card } from "@workspace/ui/components/card";
import { PaginationBar } from "@/components/pagination-bar";

export default function UserCreditTransactions({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { data, isLoading, isFetching, refetch } = api.credits.adminListByUser.useQuery({ userId, page, pageSize });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{total.toLocaleString()} transactions</div>
        <Input
          className="hidden" // reserved for future search filtering if desired
          placeholder="Search description/reason"
        />
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Date</TableHead>
              <TableHead className="w-[120px] text-right">Amount</TableHead>
              <TableHead className="w-[160px]">Reason</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                  No transactions yet.
                </TableCell>
              </TableRow>
            )}
            {items.map((t) => {
              const amt = t.amount || 0;
              const signClass = amt > 0 ? "text-green-600" : amt < 0 ? "text-red-600" : "";
              return (
                <TableRow key={t.id}>
                  <TableCell>{new Date(t.createdAt as any).toLocaleString()}</TableCell>
                  <TableCell className={`text-right font-mono ${signClass}`}>{amt.toLocaleString()}</TableCell>
                  <TableCell className="uppercase text-xs tracking-wide text-muted-foreground">{t.reason ?? "—"}</TableCell>
                  <TableCell className="whitespace-pre-wrap">{t.description || "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <PaginationBar
        page={page}
        totalPages={totalPages}
        pages={Array.from({ length: totalPages }, (_, i) => i + 1)}
        showLeftEllipsis={page > 3}
        showRightEllipsis={page < totalPages - 2}
        setPage={setPage}
      />
    </div>
  );
}

