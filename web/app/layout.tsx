import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

/*
 * Archivo, one family, committed — not the Geist/Inter default.
 *
 * This is a scoreboard before it is an app: the reign counter has to read from
 * the back of a hall, so the type needs width and weight rather than the narrow
 * neutrality of the usual UI grotesques. Archivo carries a genuine expanded
 * range and holds up large. A single family used with real weight contrast
 * beats a timid display/body pair.
 */
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
      className={`${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ground text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
