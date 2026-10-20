// While a business profile renders: the shape of the page, not a spinner.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex animate-pulse flex-col gap-6">
      <div className="h-8 w-2/3 max-w-md rounded bg-surface-3" />
      <div className="h-4 w-1/2 max-w-sm rounded bg-surface-3" />
      <div className="aspect-[16/7] rounded-card bg-surface-3" />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-16 rounded-card bg-surface-3" />
          ))}
        </div>
        <div className="hidden h-64 rounded-card bg-surface-3 lg:block" />
      </div>
    </div>
  );
}
