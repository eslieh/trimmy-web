import type { OnboardingStep } from '@/types/business';

// The business setup wizard (/setup/[businessId]/[step]), the same steps and
// order as the mobile app. The server remembers the last step saved
// (onboardingStep); setup resumes at the one after it.
export const SETUP_STEPS = [
  { key: 'basics', label: 'Basics' },
  { key: 'photos', label: 'Photos' },
  { key: 'hours', label: 'Hours' },
  { key: 'services', label: 'Services' },
  { key: 'policies', label: 'Policies' },
  { key: 'payment', label: 'Payment' },
  { key: 'team', label: 'Solo or team' },
  { key: 'review', label: 'Review & publish' },
] as const;

export type SetupStepKey = (typeof SETUP_STEPS)[number]['key'];

export function isStep(value: string): value is SetupStepKey {
  return SETUP_STEPS.some((s) => s.key === value);
}

export function nextStep(step: SetupStepKey): SetupStepKey {
  const i = SETUP_STEPS.findIndex((s) => s.key === step);
  return SETUP_STEPS[Math.min(i + 1, SETUP_STEPS.length - 1)].key;
}

export function previousStep(step: SetupStepKey): SetupStepKey | null {
  const i = SETUP_STEPS.findIndex((s) => s.key === step);
  return i > 0 ? SETUP_STEPS[i - 1].key : null;
}

// Where to resume, from the last step the server saved.
export function resumeStep(saved: OnboardingStep | null): SetupStepKey {
  switch (saved) {
    case 'business_basics':
      return 'photos';
    case 'photos':
      return 'hours';
    case 'working_hours':
      return 'services';
    case 'services':
      return 'policies';
    case 'policies':
      return 'payment';
    case 'payment_destination':
      return 'team';
    case 'team_mode':
    case 'review_publish':
      return 'review';
    default:
      return 'basics';
  }
}
