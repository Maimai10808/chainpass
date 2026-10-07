import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import { AppHeader, AppFooter } from "@/components/chainpass/app-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ChainPass — Your ticket to what comes next",
    template: "%s | ChainPass",
  },
  description:
    "Discover experiences, claim digital passes and verify ownership on Ethereum Sepolia. One pass, from discovery to entry.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-toast focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            Skip to content
          </a>
          <AppHeader />
          <main
            id="main-content"
            className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 sm:py-14"
          >
            {children}
          </main>
          <AppFooter />
        </Providers>
      </body>
    </html>
  );
}
