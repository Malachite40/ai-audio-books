import { SignInWithGoogle } from "@/components/auth/sign-in-with-google";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { api } from "@/trpc/server";
import { auth } from "@workspace/trpc/server";
import { headers } from "next/headers";

export default async function Page() {
  const { users } = await api.users.fetchAll();
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return (
    <div className="flex items-center justify-center min-h-svh">
      <div className="flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Total Users: {users.length}</h1>
        {session ? (
          <div className="flex flex-col items-center justify-center gap-4">
            <h1 className="text-2xl font-bold">{session.user.name}</h1>
            <h1 className="text-2xl font-bold">{session.user.email}</h1>
            <SignOutButton />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4">
            <h1 className="text-2xl font-bold">No session</h1>
            <SignInWithGoogle />
          </div>
        )}
      </div>
    </div>
  );
}
