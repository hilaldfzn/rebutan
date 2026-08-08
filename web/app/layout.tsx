import type { Metadata } from "next";
import { Archivo, Bungee } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

/*
 * Bungee for display, Archivo for reading.
 *
 * Bungee is a signage face — chunky, all-caps, built for arcade marquees and
 * shopfronts. It does the one job the brief demands: someone should know this is
 * a game from the wordmark alone, before reading a sentence. It is unusable at
 * body size, which is exactly why it is paired rather than used alone.
 *
 * Archivo carries everything you actually read, and its tabular figures keep the
 * counters from jittering as they tick 2.5 times a second.
 */
const bungee = Bungee({
  variable: "--font-bungee",
  subsets: ["latin"],
  weight: ["400"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Rebutan: Hold the crown",
  description:
    "One crown on Monad. You earn for every block you hold it — and a block is 400 milliseconds.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${bungee.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ground text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
