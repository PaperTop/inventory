import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Inventory — Everything in its place",
  description: "A calm, visual home for everything you own.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
