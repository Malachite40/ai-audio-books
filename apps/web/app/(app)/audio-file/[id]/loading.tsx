export type ViewAudioClientLoadingProps = {};

export default function ViewAudioClientLoading(
  props: ViewAudioClientLoadingProps
) {
  return (
    <div className="container mx-auto p-4 flex flex-col md:justify-center max-w-5xl">
      <LoadingScreen
        title="Loading Audio..."
        subtitle="Please wait while we load your audio file."
      />
    </div>
  );
}

export interface LoadingScreenProps {
  title: string;
  subtitle: string;
}

export function LoadingScreen({ title, subtitle }: LoadingScreenProps) {
  return (
    <div className="container mx-auto p-4 flex flex-col justify-center items-center max-w-5xl text-primary">
      <div className="md:border max-w-lg w-full rounded-lg sm:p-4 flex flex-col items-center justify-center min-h-[200px] animate-pulse">
        <span className="text-lg font-semibold mb-2">{title}</span>
        <span className="text-sm text-muted-foreground">{subtitle}</span>
      </div>
    </div>
  );
}
