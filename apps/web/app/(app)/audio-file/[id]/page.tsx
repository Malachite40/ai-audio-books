import Logo from "@/components/svgs/logo";
import { api } from "@/trpc/server";
import { buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { AudioLinesIcon } from "lucide-react";
import { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import ViewAudioClient from "./view.audio.client";

type tParams = Promise<{
  id: string;
}>;

type tSearchParams = Promise<{
  page?: number;
}>;

export async function generateMetadata(
  { params }: { params: tParams },
  parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { id } = await params;

  // fetch data
  const { audioFile } = await api.audio.fetch({ id });

  // optionally access and extend (rather than replace) parent metadata
  const previousImages = (await parent).openGraph?.images || [];

  if (!audioFile) {
    return {
      title: "Audio file not found",
      openGraph: {
        images: [],
      },
    };
  }

  return {
    title: audioFile.name || "Audio File",
    description: audioFile.text || undefined,
    openGraph: {
      images: previousImages,
    },
  };
}

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
