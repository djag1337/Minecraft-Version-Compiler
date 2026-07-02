export default function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 shrink-0 items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950">
      <span className="truncate text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {title}
      </span>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
