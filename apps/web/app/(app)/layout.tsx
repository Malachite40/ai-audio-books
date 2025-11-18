import { Header } from "@/components/header";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col w-dvw min-h-dvh ">
      <Header />
      <div className="flex flex-1">{children}</div>
    </div>
  );
}
