export default function ShopLoading() {
  return (
    <div className="animate-pulse">
      <div className="flex h-14 items-center justify-between border-b border-line bg-surface px-4">
        <div className="h-5 w-32 rounded bg-line" />
        <div className="h-6 w-16 rounded bg-line" />
      </div>
      <main className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-[14px] border border-line bg-surface">
              <div className="aspect-square bg-[#DDE1E6]" />
              <div className="p-3">
                <div className="h-4 w-3/4 rounded bg-line" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
