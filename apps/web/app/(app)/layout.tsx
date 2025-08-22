import { Header } from "@/components/header";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col w-dvw flex-1 min-h-full">
      <Header />
      <div className="flex flex-1">{children}</div>
    </div>
  );
}
