import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";


export const montserrat = Montserrat({
  weight: "400",
  subsets: ["cyrillic", "latin"],
  display: "swap"
});


export const metadata: Metadata = {
  title: "BGS system",
  description: "Created by BGS team",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
  return (
    <html lang="en">
      <body
        className={montserrat.className}
      >
        {children}
      </body>
    </html>
  );
}