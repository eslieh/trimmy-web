import type { Metadata } from 'next';
import { ForgotPassword } from '@/components/customer/auth/forgot-password';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return <ForgotPassword />;
}
