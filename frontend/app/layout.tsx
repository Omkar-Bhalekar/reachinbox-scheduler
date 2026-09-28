import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "ReachInbox Scheduler",
  description: "Schedule your emails effectively",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* System font stack instead of next/font/google: avoids a build-time
          fetch to Google Fonts, which fails in network-restricted environments. */}
      <body style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
