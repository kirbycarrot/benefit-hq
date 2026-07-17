import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://benefit-hq.com"),
  applicationName: "Benefit HQ",
  title: {
    default: "Benefit HQ",
    template: "%s | Benefit HQ",
  },
  description: "Build branded benefits renewal decks from census data.",
  appleWebApp: {
    capable: true,
    title: "Benefit HQ",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    siteName: "Benefit HQ",
    title: "Benefit HQ",
    description: "Build branded benefits renewal decks from census data.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Benefit HQ",
    description: "Build branded benefits renewal decks from census data.",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#0e1613",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
