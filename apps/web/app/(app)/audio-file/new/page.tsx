import { api } from "@/trpc/server";
import NewAudioClient from "./new.audio.client";

export type HomeProps = {};

export default async function Home(props: HomeProps) {
  const { speakers } = await api.speakers.fetchAll();
  return <NewAudioClient speakers={speakers} />;
}
