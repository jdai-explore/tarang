import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tarang | Jam songbook",
  description: "Join a live Tarang session and follow the song together.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.theme=localStorage.getItem('tarang-theme')||'light';document.documentElement.dataset.size=localStorage.getItem('tarang-size')||'normal'}catch(e){}` }} />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
