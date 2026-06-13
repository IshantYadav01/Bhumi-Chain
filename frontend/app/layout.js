import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#0f0f0f",
          color: "#e0e0e0",
        }}
      >
        <title>Land Registry — Private Blockchain</title>
        {children}
      </body>
    </html>
  );
}
