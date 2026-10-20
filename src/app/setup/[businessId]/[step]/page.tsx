import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SetupStepView } from '@/components/setup/wizard';
import { isStep } from '@/components/setup/steps';

export const metadata: Metadata = { title: 'Set up your business' };

export default async function SetupStepPage({ params }: PageProps<'/setup/[businessId]/[step]'>) {
  const { businessId, step } = await params;
  if (!isStep(step)) notFound();
  return <SetupStepView businessId={businessId} step={step} />;
}
