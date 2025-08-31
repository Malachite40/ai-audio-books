import { api } from "@/trpc/server";
import { HomeClient } from "./home.client";

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
