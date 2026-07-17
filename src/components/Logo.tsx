const SIZES = {
  header: { box: 30, radius: 8, font: 12 },
  hero: { box: 52, radius: 13, font: 20 },
} as const;

export function Logo({ variant = "header" }: { variant?: keyof typeof SIZES }) {
  const { box, radius, font } = SIZES[variant];
  return (
    <div
      className="flex shrink-0 items-center justify-center bg-teal-bright"
      style={{ width: box, height: box, borderRadius: radius }}
    >
      <span
        className="font-[900] text-ink-900"
        style={{ fontSize: font, letterSpacing: "-0.04em" }}
      >
        BH
      </span>
    </div>
  );
}
