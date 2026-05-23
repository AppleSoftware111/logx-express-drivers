export default function DriversLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-36 bg-gray-200 animate-pulse rounded" />
      <div className="flex gap-3">
        <div className="h-10 w-32 bg-gray-200 animate-pulse rounded-lg" />
        <div className="h-10 w-32 bg-gray-200 animate-pulse rounded-lg" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-16 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
