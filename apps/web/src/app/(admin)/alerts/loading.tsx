export default function AlertsLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-24 bg-gray-200 animate-pulse rounded" />
      <div className="space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-14 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
