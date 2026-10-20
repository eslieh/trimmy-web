import type { Metadata } from 'next';
import { SubPage } from '@/components/customer/account/sub-page';
import { PasswordForm } from '@/components/customer/account/account-forms';

export const metadata: Metadata = { title: 'Change password' };

export default function PasswordPage() {
  return (
    <SubPage title="Change password" subtitle="You'll stay signed in here; other devices are signed out.">
      <PasswordForm />
    </SubPage>
  );
}
