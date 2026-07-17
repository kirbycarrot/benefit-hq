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
      className="min-h-dvh overflow-x-hidden px-5 py-8 sm:px-8 sm:py-10 xl:flex xl:items-center xl:gap-20 xl:px-20 xl:py-16"
      style={{
        background:
          "radial-gradient(1100px 700px at 12% 8%, #1c3730 0%, #0d1613 48%, #090f0d 100%)",
      }}
    >
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4 sm:gap-[22px] xl:mx-0 xl:w-[560px] xl:shrink-0">
        <Logo variant="hero" />
        <div className="text-[11px] font-bold tracking-[0.14em] text-teal-bright uppercase">
          Benefits Proposal Workspace
        </div>
        <h1 className="text-[34px] leading-[1.08] font-extrabold tracking-[-0.02em] text-white sm:text-[42px] xl:text-[52px]">
          {heading}
        </h1>
        <p className="text-sm leading-relaxed text-warm-hero-mid sm:text-base">
          {description}
        </p>
        {statusNote && (
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-2 w-2 rounded-full bg-teal-bright" />
            <span className="text-[13px] text-warm-hero-mid">{statusNote}</span>
          </div>
        )}
      </div>

      <div className="mx-auto mt-8 w-full max-w-[420px] rounded-[18px] bg-white p-6 shadow-[0_24px_48px_rgba(0,0,0,0.35)] sm:p-8 xl:mt-0 xl:ml-auto xl:shrink-0 xl:p-10">
        <div className="mb-2 text-[11px] font-bold tracking-[0.12em] text-teal-deep uppercase">
          {cardEyebrow}
        </div>
        <h2 className="mb-6 text-[26px] font-extrabold text-text-900">{cardTitle}</h2>
        {children}
      </div>
    </div>
  );
}
