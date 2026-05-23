export default function ClientsLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-28 bg-gray-200 animate-pulse rounded" />
      <div className="space-y-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-16 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
