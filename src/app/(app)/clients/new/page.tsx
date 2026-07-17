import { ClientForm } from "@/components/ClientForm";

export default function NewClientPage() {
  return (
    <div className="max-w-lg">
      <h1 className="text-[26px] font-extrabold text-text-900">New client</h1>
      <div className="mt-6 rounded-[14px] border border-border-light bg-white p-4 shadow-[0_1px_2px_rgba(20,24,26,0.04)] sm:p-7">
        <ClientForm mode="create" />
      </div>
    </div>
  );
}
