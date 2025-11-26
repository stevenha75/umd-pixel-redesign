import type { Metadata } from "next";
import { Geist_Mono, Karla, Rubik } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ReactQueryProvider } from "@/components/providers/ReactQueryProvider";
import { Toaster } from "@/components/ui/sonner";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const karla = Karla({
  variable: "--font-head",
  subsets: ["latin"],
  weight: ["700"],
});

const rubik = Rubik({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "UMD Pixels",
  description: "Track Hack4Impact UMD attendance and pixel rewards",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${rubik.variable} ${karla.variable} ${geistMono.variable} antialiased`}
      >
        <ReactQueryProvider>
          <AuthProvider>{children}</AuthProvider>
          <Toaster />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
