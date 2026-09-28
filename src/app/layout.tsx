import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SAARTHI | Live AI Assistive Vision & Navigation',
  description:
    'Real-time computer vision assistant for visually impaired and low-vision users powered by Groq LPUs and Next.js on Vercel.',
  keywords: [
    'Assistive Vision',
    'Accessibility',
    'Blind Navigation',
    'Groq Vision',
    'Vercel',
    'Next.js',
    'Object Detection',
    'OCR',
  ],
  authors: [{ name: 'SAARTHI Assistive Vision' }],
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className={`${inter.className} min-h-full bg-slate-950 text-slate-100 antialiased`}>
        {children}
      </body>
    </html>
  );
}
