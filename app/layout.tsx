import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import "@/app/globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap"
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600"],
  display: "swap"
});

const title = "Supabase Schema Diff | Catch Breaking Migrations Before Production";
const description =
  "Compare staging vs production Supabase schemas with a visual diff for tables, columns, indexes, and RLS policies.";

export const metadata: Metadata = {
  metadataBase: new URL("https://supabase-schema-diff.com"),
  title,
  description,
  keywords: [
    "supabase schema diff",
    "supabase migration safety",
    "rls policy diff",
    "database drift detection",
    "supabase devtools"
  ],
  openGraph: {
    title,
    description,
    type: "website",
    url: "https://supabase-schema-diff.com",
    siteName: "Supabase Schema Diff"
  },
  twitter: {
    card: "summary_large_image",
    title,
    description
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} bg-[#0d1117] text-slate-100 antialiased [font-family:var(--font-space-grotesk)]`}
      >
        {children}
      </body>
    </html>
  );
}
