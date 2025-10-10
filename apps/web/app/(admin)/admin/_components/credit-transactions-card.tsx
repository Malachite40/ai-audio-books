"use client";

import { useMemo, useState } from "react";
import { api } from "@/trpc/react";
import { Card } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { PaginationBar } from "@/components/pagination-bar";

export function CreditTransactionsCard() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState<string | undefined>(
    undefined
  );

  const { data, isLoading, refetch, isRefetching } =
    api.credits.listTransactions.useQuery({ page, pageSize, search: appliedSearch });

  const totalPages = useMemo(
    () => (data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1),
    [data, pageSize]
  );

  const applySearch = () => {
    setPage(1);
    setAppliedSearch(search.trim() || undefined);
    refetch();
  };

  const clearSearch = () => {
    setSearch("");
    setAppliedSearch(undefined);
    setPage(1);
    refetch();
  };

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold">Credit Transactions</h2>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter by email, reason, description"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-80"
          />
          <Button onClick={applySearch} disabled={isLoading || isRefetching}>
            Search
          </Button>
          <Button
            variant="outline"
            onClick={clearSearch}
            disabled={isLoading || isRefetching}
          >
            Clear
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div>Loading…</div>
      ) : !data || data.items.length === 0 ? (
        <div>No transactions found.</div>
      ) : (
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead className="whitespace-nowrap">User</TableHead>
                <TableHead className="whitespace-nowrap text-right">Amount</TableHead>
                <TableHead className="whitespace-nowrap">Reason</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((t) => {
                const isPositive = t.amount >= 0;
                const formatted = Math.abs(t.amount).toLocaleString();
                return (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t.user?.email ?? t.userId}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className={isPositive ? "text-green-600" : "text-red-600"}>
                        {isPositive ? "+" : "-"}
                        {formatted}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{t.reason}</TableCell>
                    <TableCell className="max-w-[600px] truncate">
                      {t.description}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <PaginationBar
        page={page}
        totalPages={totalPages}
        pages={Array.from({ length: totalPages }, (_, i) => i + 1)}
        showLeftEllipsis={page > 3}
        showRightEllipsis={page < totalPages - 2}
        setPage={setPage}
      />
    </Card>
  );
}

