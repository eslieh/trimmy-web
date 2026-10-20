'use client';

import { createContext, useContext } from 'react';

// Set by the business setup wizard (src/app/setup) around the settings forms
// it reuses as steps: their save button reads "Save & continue", saves even
// when nothing changed (a step's defaults count), and moves on afterwards.
// Outside the wizard it's null and the forms behave as plain settings pages.
export type SetupStep = { next: () => void };

const Ctx = createContext<SetupStep | null>(null);

export function SetupStepProvider({ value, children }: { value: SetupStep; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSetupStep(): SetupStep | null {
  return useContext(Ctx);
}
