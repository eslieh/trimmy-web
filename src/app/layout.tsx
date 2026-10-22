import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { getSession } from '@/lib/server/auth';
import { SessionProvider } from '@/components/session';
import { Toaster } from '@/components/ui/toast';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta-sans', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Trimmy: book salons and barbers near you', template: '%s · Trimmy' },
  description: 'Find salons, barbershops and spas near you, see real availability, and book in seconds.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-dvh font-sans">
        <SessionProvider initial={session}>
          {children}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
