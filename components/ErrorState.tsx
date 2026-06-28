import ErrorIcon from "./ErrorIcon";

export default function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="w-12 h-12 rounded-full bg-(--color-surface) border border-(--color-border) flex items-center justify-center">
        <ErrorIcon size={24} />
      </div>
      <p className="text-sm text-(--color-text-secondary)">Gagal memuat: {message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 text-[13px] font-medium rounded-lg bg-(--color-surface) border border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-border) transition-colors"
        >
          Coba Lagi
        </button>
      )}
    </div>
  );
}
