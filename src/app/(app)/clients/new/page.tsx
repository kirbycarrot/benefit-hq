import { ClientForm } from "@/components/ClientForm";

export default function NewClientPage() {
  return (
    <div className="max-w-[760px]">
      <h1 className="text-[26px] font-extrabold text-text-900">New client</h1>
      <p className="mt-1 max-w-[620px] text-sm text-text-600">
        Create the client workspace, then continue through the guided onboarding intake.
      </p>
      <div className="mt-6 rounded-[14px] border border-border-light bg-white p-4 shadow-[0_1px_2px_rgba(20,24,26,0.04)] sm:p-7">
        <ClientForm />
      </div>
    </div>
  );
}
