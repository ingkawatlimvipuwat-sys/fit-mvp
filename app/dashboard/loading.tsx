export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-48 rounded bg-control/60" />
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-[14px] border border-line bg-surface">
            <div className="aspect-square bg-[#DDE1E6]" />
            <div className="p-3">
              <div className="h-4 w-3/4 rounded bg-[#DDE1E6]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
