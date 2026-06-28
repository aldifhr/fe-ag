export default function EmptyState({ icon, title, subtitle }: { icon?: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center text-(--color-text-secondary)">
      {icon && <div className="w-12 h-12 rounded-full bg-(--color-surface) border border-(--color-border) flex items-center justify-center">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {subtitle && <p className="text-xs">{subtitle}</p>}
    </div>
  );
}
