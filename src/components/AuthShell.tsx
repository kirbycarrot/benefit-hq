import { Logo } from "./Logo";

export function AuthShell({
  cardEyebrow,
  cardTitle,
  cardDescription,
  children,
}: {
  cardEyebrow: string;
  cardTitle: string;
  cardDescription: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-dvh items-center justify-center px-5 py-10"
      style={{
        background:
          "radial-gradient(1100px 700px at 12% 8%, #1c3730 0%, #0d1613 48%, #090f0d 100%)",
      }}
    >
      <div className="w-full max-w-[380px] rounded-[18px] bg-white p-6 shadow-[0_24px_48px_rgba(0,0,0,0.35)] sm:p-8">
        <div className="mb-5 flex items-center gap-2.5">
          <Logo variant="header" />
          <span className="text-[15px] font-extrabold text-text-900">Benefit HQ</span>
        </div>
        <div className="mb-1 text-[11px] font-bold tracking-[0.12em] text-teal-deep uppercase">
          {cardEyebrow}
        </div>
        <h1 className="text-[26px] font-extrabold text-text-900">{cardTitle}</h1>
        <p className="mt-1 mb-6 text-sm text-text-600">{cardDescription}</p>
        {children}
      </div>
    </div>
  );
}
