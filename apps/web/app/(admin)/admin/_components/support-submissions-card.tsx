import { PaginationBar } from "@/components/pagination-bar";
import { api } from "@/trpc/react";
import { Card } from "@workspace/ui/components/card";
import { useState } from "react";

export function SupportSubmissionsCard() {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { data, isLoading } = api.support.fetchAll.useQuery({
    page,
    pageSize,
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;
  const submissions = data?.submissions || [];

  return (
    <Card className="p-4 mb-6">
      <h2 className="text-xl font-semibold mb-2">Support Submissions</h2>
      {isLoading ? (
        <div>Loading...</div>
      ) : submissions.length === 0 ? (
        <div>No support submissions found.</div>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => (
            <div key={submission.id} className="border rounded p-3">
              <div className="font-bold">{submission.name}</div>
              <div className=" mb-1">{submission.description}</div>
              <div className="text-xs text-gray-400">
                {new Date(submission.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
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
