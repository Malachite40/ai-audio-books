"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Card } from "@workspace/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { PaginationBar } from "@/components/pagination-bar";

export default function UserSupportSubmissions({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { data, isLoading } = api.support.adminListByUser.useQuery({ userId, page, pageSize });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">{total.toLocaleString()} submissions</div>
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Date</TableHead>
              <TableHead className="w-[220px]">Name</TableHead>
              <TableHead className="w-[260px]">Email</TableHead>
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
                  No submissions.
                </TableCell>
              </TableRow>
            )}
            {items.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{new Date(s.createdAt as any).toLocaleString()}</TableCell>
                <TableCell>{s.name}</TableCell>
                <TableCell className="text-muted-foreground">{s.email || "—"}</TableCell>
                <TableCell className="whitespace-pre-wrap">{s.description}</TableCell>
              </TableRow>
            ))}
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

