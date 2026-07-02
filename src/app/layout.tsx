import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Minecraft Version Compiler",
  description: "Build Fabric mods with AI assistance and decompiled vanilla source for reference.",
};

// Dark is the default; this runs before paint so a stored "light" preference
// never flashes dark first. Kept out of React state so it can run pre-hydration.
const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem('theme')==='light'){document.documentElement.classList.remove('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex h-full min-h-full w-full flex-col overflow-x-hidden bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            <span className="inline-block size-2 rounded-sm bg-emerald-500" aria-hidden />
            Minecraft Version Compiler
          </Link>
          <ThemeToggle />
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
      </body>
    </html>
  );
}
