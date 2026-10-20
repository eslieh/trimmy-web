import type { Metadata } from 'next';
import { LegalPlaceholder } from '@/components/customer/legal-placeholder';

export const metadata: Metadata = { title: 'Terms of service' };

export default function TermsPage() {
  return <LegalPlaceholder title="Terms of service" other={{ href: '/legal/privacy', label: 'Privacy policy' }} />;
}
