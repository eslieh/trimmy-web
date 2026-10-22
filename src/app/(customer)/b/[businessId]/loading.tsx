// While a business profile renders: the shape of the page, not a spinner.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex animate-pulse flex-col gap-8">
      <div>
        <div className="h-3 w-32 rounded bg-ink/[0.06]" />
        <div className="mt-4 h-10 w-2/3 max-w-md rounded bg-ink/[0.06]" />
        <div className="mt-3 h-4 w-1/2 max-w-sm rounded bg-ink/[0.06]" />
      </div>
      <div className="aspect-[16/7] rounded-[2rem] bg-ink/[0.06]" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-3xl bg-ink/[0.04]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-2 rounded-3xl bg-ink/[0.03] p-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-ink/[0.05]" />
          ))}
        </div>
        <div className="hidden h-64 rounded-[2rem] bg-ink/[0.04] lg:block" />
      </div>
    </div>
  );
}
