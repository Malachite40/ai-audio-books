import { api } from "@/trpc/server";
import { Card } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import UserCreditTransactions from "./_components/user-credit-transactions";
import UserAudioFiles from "./_components/user-audio-files";
import UserSupportSubmissions from "./_components/user-support";

type tParams = Promise<{ id: string }>;

export default async function AdminUserDetailPage({
  params,
}: {
  params: tParams;
}) {
  const { id } = await params;
  const { user, stats } = await api.users.adminGetById({ id });

  if (!user) {
    return (
      <div className="container mx-auto p-4">
        <Card className="p-6">User not found.</Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{user.name || user.email}</h2>
              <Badge variant="secondary">{user.role || "user"}</Badge>
              {user.banned && <Badge variant="destructive">Banned</Badge>}
            </div>
            <div className="text-sm text-muted-foreground flex flex-wrap gap-4">
              <span>Email: {user.email}</span>
              <span>Credits: {user.Credits?.amount ?? 0}</span>
              <span>Plan: {user.Subscription?.plan ?? "—"}</span>
              <span>
                Created: {new Date(user.createdAt as any).toLocaleString()}
              </span>
              <span>
                Updated: {new Date(user.updatedAt as any).toLocaleString()}
              </span>
              <span>Audio Files: {stats?.audioCount ?? 0}</span>
            </div>
            {user.banned && (
              <div className="text-sm text-red-600">
                Reason: {user.banReason || "—"}
                {user.banExpires && (
                  <>
                    {" "}- Expires: {new Date(user.banExpires as any).toLocaleString()}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <Tabs defaultValue="credits">
          <TabsList>
            <TabsTrigger value="credits">Credit Transactions</TabsTrigger>
            <TabsTrigger value="audio">Audio Files</TabsTrigger>
            <TabsTrigger value="support">Support</TabsTrigger>
          </TabsList>
          <TabsContent value="credits">
            <UserCreditTransactions userId={user.id} />
          </TabsContent>
          <TabsContent value="audio">
            <UserAudioFiles userId={user.id} />
          </TabsContent>
          <TabsContent value="support">
            <UserSupportSubmissions userId={user.id} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
