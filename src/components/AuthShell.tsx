import { Logo } from "./Logo";

export function AuthShell({
  heading,
  description,
  statusNote,
  cardEyebrow,
  cardTitle,
  children,
}: {
  heading: string;
  description: string;
  statusNote?: string;
  cardEyebrow: string;
  cardTitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen items-center gap-20 overflow-hidden px-20 py-16"
      style={{
        background:
          "radial-gradient(1100px 700px at 12% 8%, #1c3730 0%, #0d1613 48%, #090f0d 100%)",
      }}
    >
      <div className="flex w-[560px] shrink-0 flex-col gap-[22px]">
        <Logo variant="hero" />
        <div className="text-[11px] font-bold tracking-[0.14em] text-teal-bright uppercase">
          Benefits Proposal Workspace
        </div>
        <h1 className="text-[52px] leading-[1.08] font-extrabold tracking-[-0.02em] text-white">
          {heading}
        </h1>
        <p className="text-base leading-relaxed text-warm-hero-mid">{description}</p>
        {statusNote && (
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-2 w-2 rounded-full bg-teal-bright" />
            <span className="text-[13px] text-warm-hero-mid">{statusNote}</span>
          </div>
        )}
      </div>

      <div className="ml-auto w-[420px] shrink-0 rounded-[18px] bg-white p-10 shadow-[0_24px_48px_rgba(0,0,0,0.35)]">
        <div className="mb-2 text-[11px] font-bold tracking-[0.12em] text-teal-deep uppercase">
          {cardEyebrow}
        </div>
        <h2 className="mb-6 text-[26px] font-extrabold text-text-900">{cardTitle}</h2>
        {children}
      </div>
    </div>
  );
}
