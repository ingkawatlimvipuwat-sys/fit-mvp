export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-48 rounded bg-gray-200" />
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
    </div>
  );
}
