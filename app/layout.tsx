import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PDF to TXT',
  description: 'Conversion locale de PDF vers TXT via pdftotext',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
