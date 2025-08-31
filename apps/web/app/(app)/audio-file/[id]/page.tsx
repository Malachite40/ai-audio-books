import Logo from "@/components/svgs/logo";
import { api } from "@/trpc/server";
import { buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { AudioLinesIcon } from "lucide-react";
import Link from "next/link";
import ViewAudioClient from "./view.audio.client";

type tParams = Promise<{
  id: string;
}>;

type tSearchParams = Promise<{
  page?: number;
}>;

export default async function Home(props: {
  params: tParams;
  searchParams: tSearchParams;
}) {
  const { id } = await props.params;
  const { audioFile } = await api.audio.fetch({ id });

  if (!audioFile)
    return (
      <div className="mb-4 w-full justify-center flex items-center flex-col">
        <Logo className="size-30" />
        <p className="mb-4">No audio file found.</p>
        <Link
          href={`/audio-file/new`}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <AudioLinesIcon className="h-4 w-4" />
          Create New Audio File
        </Link>
      </div>
    );
  return <ViewAudioClient af={audioFile} />;
}
