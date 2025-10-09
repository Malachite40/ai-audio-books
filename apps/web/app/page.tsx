import { env } from "@/env";
import { api } from "@/trpc/server";
import { buttonVariants } from "@workspace/ui/components/button";
import { Metadata } from "next";
import Link from "next/link";
import { HomeClient } from "./home.client";

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(env.NEXT_PUBLIC_BASE_URL),
    title: "Instant Audio Online",
    description: "Create and listen to audio books instantly. Affordably.",
    openGraph: {
      images: ["/logo.png"],
    },
  };
}

export default async function Home() {
  const { kv } = await api.kv.getByKey({ key: "home-audio-file-id" });

  if (!kv) {
    return <>no kv set</>;
  }

  const { audioFile } = await api.audio.fetch({ id: kv.value });

  if (!audioFile) {
    return (
      <div className="flex flex-1 justify-center items-center h-dvh">
        <Link
          href={"/audio-file/new"}
          className={buttonVariants({ variant: "default" })}
        >
          New Audio File
        </Link>
      </div>
    );
  }

  return <HomeClient af={audioFile} speaker={audioFile.speaker} />;
}
