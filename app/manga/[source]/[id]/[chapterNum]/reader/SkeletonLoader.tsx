export function SkeletonLoader() {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="skeleton w-full max-w-3xl aspect-3/4 rounded-lg"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}
