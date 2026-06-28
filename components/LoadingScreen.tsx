export default function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] w-full gap-4">
      {/* Logo pulse */}
      <div className="relative">
        <h1 className="text-2xl font-bold tracking-tight text-(--color-text)">
          Manhwa<span className="text-(--color-accent)">.Agg</span>
        </h1>
        <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-(--color-accent)/30 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-(--color-accent) rounded-full animate-loading-bar" />
        </div>
      </div>

      {/* Loading dots */}
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-(--color-accent) animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-(--color-accent) animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-(--color-accent) animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
