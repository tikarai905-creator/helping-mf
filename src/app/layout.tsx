import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const warmSans = Nunito({
  variable: "--font-warm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Neighbor — a community help board",
  description: "Post a need. Someone nearby raises a hand. You choose who gets in.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${warmSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-cream text-ink">
        <Nav />
        <main className="mx-auto w-full max-w-2xl min-h-0 flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-border py-4 text-center text-xs text-muted">
          We connect people. We don&apos;t vet them.{" "}
          <a href="/terms" className="underline">
            Terms &amp; how this works
          </a>
        </footer>
      </body>
    </html>
  );
}
