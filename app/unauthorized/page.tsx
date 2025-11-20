export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Эрх хүрэхгүй</h1>
        <p className="text-gray-600 mb-8">Та энэ хуудсыг харах эрхгүй байна.</p>
        <a
          href="/dashboard"
          className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600">
          Хянах самбар руу буцах
        </a>
      </div>
    </div>
  );
}
