import type { Metadata } from 'next';
import { LegalPlaceholder } from '@/components/customer/legal-placeholder';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return <LegalPlaceholder title="Privacy policy" other={{ href: '/legal/terms', label: 'Terms of service' }} />;
}
