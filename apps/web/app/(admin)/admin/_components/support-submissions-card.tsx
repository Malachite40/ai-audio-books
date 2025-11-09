import { PaginationBar } from "@/components/pagination-bar";
import { api } from "@/trpc/react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
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
  const utils = api.useUtils();
  const { data: unreadCount } = api.support.adminUnreadCount.useQuery(
    undefined,
    {
      refetchInterval: 30000,
    }
  );

  const markRead = api.support.adminMarkRead.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.support.fetchAll.invalidate(),
        utils.support.adminUnreadCount.invalidate(),
      ]);
    },
  });

  const markUnread = api.support.adminMarkUnread.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.support.fetchAll.invalidate(),
        utils.support.adminUnreadCount.invalidate(),
      ]);
    },
  });

  const markAll = api.support.adminMarkAllRead.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.support.fetchAll.invalidate(),
        utils.support.adminUnreadCount.invalidate(),
      ]);
    },
  });

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h2 className="text-xl font-semibold">Support Submissions</h2>
        <div className="flex items-center gap-2">
          {(unreadCount ?? 0) > 0 && (
            <Badge variant="secondary">{unreadCount} unread</Badge>
          )}
          <Button
            size="sm"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending || (unreadCount ?? 0) === 0}
          >
            Mark all as read
          </Button>
        </div>
      </div>
      {isLoading ? (
        <div>Loading...</div>
      ) : submissions.length === 0 ? (
        <div>No support submissions found.</div>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => {
            const unread = !submission.readAt;
            return (
              <div key={submission.id} className="border rounded p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`font-bold ${unread ? "" : "text-muted-foreground"}`}
                    >
                      {submission.name}
                    </div>
                    {unread && (
                      <div className="size-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {unread ? (
                      <Button
                        size="sm"
                        onClick={() => markRead.mutate({ id: submission.id })}
                        disabled={markRead.isPending}
                      >
                        Mark as read
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markUnread.mutate({ id: submission.id })}
                        disabled={markUnread.isPending}
                      >
                        Mark as unread
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mb-1 whitespace-pre-wrap">
                  {submission.description}
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(submission.createdAt).toLocaleString()}
                </div>
              </div>
            );
          })}
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
