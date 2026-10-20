import type { WeeklyHours } from './business';

export type TeamRole = 'front_desk' | 'staff';

export type InvitationStatus = 'pending' | 'accepted' | 'declined';

// An invitation as seen by the invited person (GET /me/invitations),
// as opposed to the owner's-eye view created during business setup.
export type MyInvitation = {
  invitationId: string;
  businessId: string;
  businessName: string;
  role: TeamRole;
  status: InvitationStatus;
  sentAt: string;
};

// The owner's-eye view of an invitation they sent — doubles as the team
// roster once accepted (status flips 'pending' -> 'accepted'), rather than
// a separate "team member" record: there's no staff/front-desk signup flow
// built yet (see business-owner.md's Get Started story, team.json's
// list-my-invitations/respond-to-invitation), so an invitation IS the only
// record of a team member this app has. `name`/`commissionPercent`/
// `workingDays` are set by the owner (at invite time via the post-publish
// Team screen, or edited later from Member Detail) — onboarding's Team
// invite step only ever collects email/phone/role, so invitations sent
// during setup default `commissionPercent` and leave `name`/`workingDays`
// unset until the owner fills them in from the Team screen.
export type TeamInvitation = {
  invitationId: string;
  businessId: string;
  // The person's staff record — null while the invitation is pending, set
  // once accepted. This (not invitationId) is the id bookings, availability
  // and earnings use; it's the same as the business profile's staff[].staffId.
  staffId: string | null;
  name?: string;
  email?: string;
  phone?: string;
  role: TeamRole;
  status: InvitationStatus;
  commissionPercent: number;
  workingDays: (keyof WeeklyHours)[] | null; // null = follows the business's own working days
  sentAt: string;
};
