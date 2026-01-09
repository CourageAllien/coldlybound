import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ColdlyBound | AI Cold Email Generator",
  description: "Generate hyper-personalized cold emails with AI using 29 proven frameworks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
