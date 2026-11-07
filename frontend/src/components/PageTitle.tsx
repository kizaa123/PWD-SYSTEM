export function PageTitle({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-xl font-bold tracking-tight text-navy sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {children ? (
        <div className="flex w-full shrink-0 flex-wrap justify-end gap-2 sm:w-auto">{children}</div>
      ) : null}
    </div>
  );
}
