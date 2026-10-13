export const visaTypes = {
  A: { label: "Skilled Worker", durationMinutes: 30 },
  B: { label: "Family / Dependent", durationMinutes: 60 },
} as const;

export type VisaType = keyof typeof visaTypes;

export function isVisaType(code: string): code is VisaType {
  return Object.hasOwn(visaTypes, code);
}

export const visaTypeList: readonly VisaType[] =
  Object.keys(visaTypes).filter(isVisaType);
