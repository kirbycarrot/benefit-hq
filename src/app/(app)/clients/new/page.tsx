import { ClientForm } from "@/components/ClientForm";

export default function NewClientPage() {
  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-gray-900">New client</h1>
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <ClientForm mode="create" />
      </div>
    </div>
  );
}
