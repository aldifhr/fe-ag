export default function SkeletonGrid() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-3 p-3 rounded-lg bg-(--color-surface) border border-(--color-border)"
        >
          <div className="w-14 h-20 skeleton rounded-md shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="skeleton h-4 w-2/3 rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
            <div className="skeleton h-3 w-1/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
