import Image from 'next/image';
import { Logo } from '@/components/ui/misc';

// Sign in, sign up, verify, recover: one centred card on the landing's sky,
// no site chrome.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center px-4 py-10">
      <Image src="/sky.avif" alt="" fill priority sizes="100vw" className="-z-10 object-cover object-top" />
      <Logo height={32} light />
      <div className="mt-8 w-full max-w-md animate-fade-in rounded-sheet bg-white p-6 shadow-raised sm:p-8">{children}</div>
    </div>
  );
}
