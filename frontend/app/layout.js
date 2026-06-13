import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600"],
  variable: "--font-poppins",
});

export const metadata = {
  title: "Bhumi Chain- Land Registry System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} font-[family-name:var(--font-poppins)] m-0 text-[#0C0E12] bg-[#E6EDF3]`}
      >
        {children}
      </body>
    </html>
  );
}
