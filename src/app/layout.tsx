import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/app/providers";
import { getThemeColorBootScript } from "@/lib/theme/colors";

import { Inter, Bricolage_Grotesque } from "next/font/google";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Cashly",
    template: "%s · Cashly",
  },
  description: "Personal expense & income tracking with real-time sync and offline support.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: getThemeColorBootScript(),
          }}
        />
      </head>
      <body className={`${inter.variable} ${bricolage.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
