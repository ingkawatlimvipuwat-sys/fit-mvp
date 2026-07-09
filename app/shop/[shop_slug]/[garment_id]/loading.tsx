export default function GarmentLoading() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="h-5 w-32 rounded bg-gray-200" />
        <div className="h-6 w-16 rounded bg-gray-200" />
      </div>
      <main className="mx-auto max-w-2xl px-6 py-8">
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="mt-3 aspect-square rounded bg-gray-200" />
        <div className="mt-4 h-6 w-2/3 rounded bg-gray-200" />
        <div className="mt-8 space-y-4 rounded border bg-white p-4">
          <div className="h-5 w-40 rounded bg-gray-200" />
          <div className="h-10 rounded bg-gray-200" />
          <div className="h-10 rounded bg-gray-200" />
          <div className="h-10 w-full rounded bg-gray-200" />
        </div>
      </main>
    </div>
  );
}
