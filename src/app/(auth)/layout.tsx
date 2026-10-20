import { Logo } from '@/components/ui/misc';

// Sign in, sign up, verify, recover: one centred card, no site chrome.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-surface-2 px-4 py-10">
      <Logo height={32} />
      <div className="mt-8 w-full max-w-md rounded-sheet border border-line bg-white p-6 shadow-card sm:p-8">{children}</div>
    </div>
  );
}
