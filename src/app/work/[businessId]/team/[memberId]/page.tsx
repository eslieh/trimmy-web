import type { Metadata } from 'next';
import { requireOwner } from '@/lib/server/auth';
import { MemberDetail } from '@/components/work-manage/member';

export const metadata: Metadata = { title: 'Team member' };

// memberId is the roster record's invitationId (see mobile api/team.ts).
export default async function TeamMemberPage({ params }: PageProps<'/work/[businessId]/team/[memberId]'>) {
  const { businessId, memberId } = await params;
  await requireOwner(businessId);
  return <MemberDetail key={memberId} memberId={memberId} />;
}
