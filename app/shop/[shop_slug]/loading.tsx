export default function ShopLoading() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="h-5 w-32 rounded bg-gray-200" />
        <div className="h-6 w-16 rounded bg-gray-200" />
      </div>
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded border bg-white">
              <div className="aspect-square bg-gray-200" />
              <div className="p-3">
                <div className="h-4 w-3/4 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
