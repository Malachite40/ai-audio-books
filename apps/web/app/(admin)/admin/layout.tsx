import { FullScreenSignIn } from "@/components/sign-in";
import { api } from "@/trpc/server";

export default async function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user } = await api.users.self();
  if (!user) {
    return <FullScreenSignIn />;
  }

  if (user.role !== "admin") {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <h1 className="text-2xl font-bold">
          You do not have access to this page
        </h1>
      </div>
    );
  }

  return <>{children}</>;
}
