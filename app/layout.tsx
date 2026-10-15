import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SessionWrapper } from '@/components/SessionWrapper';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'RestoHub — Restaurant Management',
  description: 'Professional restaurant POS system with REST API and MCP support',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`} suppressHydrationWarning>
        <SessionWrapper>{children}</SessionWrapper>
      </body>
    </html>
  );
}
