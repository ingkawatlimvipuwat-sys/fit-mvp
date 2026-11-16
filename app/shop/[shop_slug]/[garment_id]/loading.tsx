export default function GarmentLoading() {
  return (
    <div className="animate-pulse">
      <div className="flex h-14 items-center justify-between border-b border-line bg-surface px-4">
        <div className="h-5 w-32 rounded bg-line" />
        <div className="h-6 w-16 rounded bg-line" />
      </div>
      <main className="mx-auto max-w-2xl px-4 py-4">
        <div className="h-4 w-24 rounded bg-line" />
        <div className="mt-3 aspect-square rounded-2xl bg-[#DDE1E6]" />
        <div className="mt-4 h-6 w-2/3 rounded bg-line" />
        <div className="mt-8 space-y-4 rounded-2xl border border-line bg-surface p-4">
          <div className="h-5 w-40 rounded bg-line" />
          <div className="h-10 rounded bg-line" />
          <div className="h-10 rounded bg-line" />
          <div className="h-10 w-full rounded bg-line" />
        </div>
      </main>
    </div>
  );
}
