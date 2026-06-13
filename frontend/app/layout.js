import "./globals.css";

export const metadata = {
  title: "Land Registry — Private Blockchain",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="m-0 font-sans bg-[#0f0f0f] text-[#e0e0e0]">
        {children}
      </body>
    </html>
  );
}
