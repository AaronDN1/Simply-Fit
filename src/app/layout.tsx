import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import { Providers } from "@/components/providers";
import { THEME_BOOT, THEME_COLOR } from "@/lib/theme-boot";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Simply Fit — Plan less. Do more.", template: "%s · Simply Fit" },
  description: "One clear plan for your food, training, activity, recovery, and goals.",
  applicationName: "Simply Fit",
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR.light,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${serif.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
