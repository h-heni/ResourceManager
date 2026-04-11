interface PlaceholderPageProps {
  title: string;
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <p className="text-gray-500">{title} page - Coming soon</p>
        <p className="text-sm text-gray-400 mt-2">
          This page will be populated with real data when connected to the backend.
        </p>
      </div>
    </div>
  );
}
