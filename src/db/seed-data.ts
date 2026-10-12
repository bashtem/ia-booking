type SeedWindow = {
  startsAt: Date;
  endsAt: Date;
};

export type SeedAdvisor = {
  id: string;
  name: string;
  availability: readonly SeedWindow[];
};

function window(start: string, end: string): SeedWindow {
  return {
    startsAt: new Date(start),
    endsAt: new Date(end),
  };
}

// Fixture availability moved from March 2025 to November 2026.
// Day numbers and clock times are unchanged, including the three-minute gap
// on 10 November for ia-002.
export const seedAdvisors = [
  {
    id: "ia-001",
    name: "Sofia Andersson",
    availability: [
      window("2026-11-10T09:00:00Z", "2026-11-10T10:50:00Z"),
      window("2026-11-11T14:00:00Z", "2026-11-11T14:20:00Z"),
      window("2026-11-12T10:00:00Z", "2026-11-12T11:30:00Z"),
      window("2026-11-13T09:00:00Z", "2026-11-13T10:00:00Z"),
      window("2026-11-14T11:00:00Z", "2026-11-14T12:30:00Z"),
      window("2026-11-18T14:00:00Z", "2026-11-18T15:30:00Z"),
      window("2026-11-19T09:00:00Z", "2026-11-19T10:00:00Z"),
      window("2026-11-20T10:00:00Z", "2026-11-20T11:30:00Z"),
      window("2026-11-21T09:00:00Z", "2026-11-21T10:00:00Z"),
    ],
  },
  {
    id: "ia-002",
    name: "Rajan Patel",
    availability: [
      window("2026-11-10T09:00:00Z", "2026-11-10T09:30:00Z"),
      window("2026-11-10T09:33:00Z", "2026-11-10T11:30:00Z"),
      window("2026-11-11T14:00:00Z", "2026-11-11T15:00:00Z"),
      window("2026-11-12T09:00:00Z", "2026-11-12T10:00:00Z"),
      window("2026-11-13T09:00:00Z", "2026-11-13T10:30:00Z"),
      window("2026-11-14T11:00:00Z", "2026-11-14T12:00:00Z"),
      window("2026-11-17T09:00:00Z", "2026-11-17T10:30:00Z"),
      window("2026-11-18T14:00:00Z", "2026-11-18T14:25:00Z"),
      window("2026-11-19T09:00:00Z", "2026-11-19T10:30:00Z"),
      window("2026-11-20T11:00:00Z", "2026-11-20T12:00:00Z"),
      window("2026-11-21T09:00:00Z", "2026-11-21T10:00:00Z"),
    ],
  },
] as const satisfies readonly SeedAdvisor[];
