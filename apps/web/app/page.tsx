import { api } from "@/trpc/server";
import { Metadata } from "next";
import { HomeClient } from "./home.client";

export async function generateMetadata(): Promise<Metadata> {
  return {
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
    return <>no audio file found</>;
  }

  return <HomeClient af={audioFile!} />;
}
