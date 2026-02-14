import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ADAS Intelligence Portal",
  description: "ADAS calibration intelligence for collision shops",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
