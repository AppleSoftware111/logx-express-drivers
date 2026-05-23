export default function OperationsLoading() {
  return (
    <div className="flex h-[calc(100vh-64px)]">
      <div className="w-80 border-r border-gray-200 p-4 space-y-3">
        <div className="h-6 w-32 bg-gray-200 animate-pulse rounded" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 h-16 animate-pulse" />
        ))}
      </div>
      <div className="flex-1 bg-gray-100 animate-pulse" />
    </div>
  );
}
