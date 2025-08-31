export type ViewAudioClientLoadingProps = {};

export default function ViewAudioClientLoading(
  props: ViewAudioClientLoadingProps
) {
  return (
    <div className="mb-4 w-full gap-4 text-primary justify-center flex items-center flex-col animate-pulse duration-100">
      <p className="mb-4">Loading...</p>
    </div>
  );
}
