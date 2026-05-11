import Navbar from "@/components/navbar";
import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en" >
      <body>
        {children}
        <Navbar/>
        </body>
    </html>
  );
}
