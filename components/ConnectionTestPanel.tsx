import { checkConnection } from "@/lib/connection";
import ErrorState from "@/components/ErrorState";

export default function ConnectionTestPanel({
  error,
  refetch,
  connStatus,
  setConnStatus,
  checking,
  setChecking,
}: {
  error: string;
  refetch: () => void;
  connStatus: { backend: boolean; shinigami: boolean } | null;
  setConnStatus: (v: { backend: boolean; shinigami: boolean } | null) => void;
  checking: boolean;
  setChecking: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <ErrorState message={error} onRetry={() => refetch()} />
      {connStatus && !connStatus.backend && (
        <p className="text-[12px] text-(--color-danger)">
          Tidak dapat terhubung ke server. Pastikan backend berjalan di
          localhost:3000
        </p>
      )}
      {connStatus && connStatus.backend && !connStatus.shinigami && (
        <p className="text-[12px] text-yellow-400">
          Shinigami sedang tidak tersedia
        </p>
      )}
      <button
        onClick={async () => {
          setChecking(true);
          const result = await checkConnection();
          setConnStatus(result);
          setChecking(false);
        }}
        disabled={checking}
        className="px-4 py-2 text-[13px] font-medium rounded-lg bg-(--color-surface) border border-(--color-border) text-(--color-text-secondary) hover:text-(--color-text) hover:border-(--color-border-hover) transition-colors duration-150 disabled:opacity-50"
      >
        {checking ? "Menguji..." : "Test koneksi"}
      </button>
      {connStatus && (
        <div className="mt-2 flex items-center gap-4 text-[11px]">
          <span
            className={
              connStatus.backend ? "text-emerald-400" : "text-red-400"
            }
          >
            Backend: {connStatus.backend ? "OK" : "Offline"}
          </span>
          <span
            className={
              connStatus.shinigami ? "text-emerald-400" : "text-red-400"
            }
          >
            Shinigami: {connStatus.shinigami ? "OK" : "Offline"}
          </span>
        </div>
      )}
    </div>
  );
}
