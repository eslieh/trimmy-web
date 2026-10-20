import { redirect } from 'next/navigation';
import { serverApi } from '@/lib/server/api';
import { resumeStep } from '@/components/setup/steps';
import type { BusinessDetail } from '@/types/work-manage';

// Pick up where they left off (the server remembers the last step saved).
export default async function SetupResume({ params }: PageProps<'/setup/[businessId]'>) {
  const { businessId } = await params;
  const business = await serverApi<BusinessDetail>(`/businesses/${businessId}`);
  if (business.status === 'published') redirect(`/work/${businessId}/today`);
  redirect(`/setup/${businessId}/${resumeStep(business.onboardingStep)}`);
}
