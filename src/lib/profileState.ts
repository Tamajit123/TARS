export type ProfileValues = { name: string; instructions: string };
export const normalizeProfile = (profile: ProfileValues): ProfileValues => ({ name: profile.name.trim(), instructions: profile.instructions.trim() });
export function profileChanged(saved: ProfileValues, draft: ProfileValues) {
  const a = normalizeProfile(saved); const b = normalizeProfile(draft);
  return a.name !== b.name || a.instructions !== b.instructions;
}
export function validateProfile(profile: ProfileValues) {
  if (!profile.name.trim()) return 'Enter your display name.';
  if (profile.name.trim().length > 80) return 'Keep your display name under 81 characters.';
  if (profile.instructions.trim().length > 4000) return 'Keep assistant preferences under 4,001 characters.';
  return null;
}
