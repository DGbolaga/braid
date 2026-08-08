import type { components } from "../types";

type S = components["schemas"];

/** Fixed clock so fixtures are deterministic and diffs stay readable. */
export const NOW = new Date("2026-08-08T09:00:00.000Z");

const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString();
const daysAhead = (n: number) =>
  new Date(NOW.getTime() + n * 86_400_000).toISOString();

/** Readable, valid-shaped ids. The leading group names the entity kind. */
const uuid = (kind: number, n: number) =>
  `${String(kind).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;

const ORG = uuid(1, 1);
const PROGRAM = uuid(2, 1);
const account = (n: number) => uuid(3, n);
const participation = (n: number) => uuid(4, n);
const pair = (n: number) => uuid(7, n);
const strand = (n: number) => uuid(8, n);
const message = (n: number) => uuid(9, n);

export const PROGRAM_ID = PROGRAM;
export const ORG_SLUG = "she-code-africa";
export const PROGRAM_SLUG = "backend-cohort-4";

const organisation: S["Organisation"] = {
  id: ORG,
  slug: ORG_SLUG,
  name: "She Code Africa",
  logoUrl: null,
};

// name, timezone, skills, capacity, load, headline, completeness
type MentorSeed = [string, string, string[], number, number, string, number];

const MENTORS: MentorSeed[] = [
  ["Amara Okonkwo", "Africa/Lagos", ["Python", "Django", "API design"], 3, 3, "Staff engineer, payments", 1],
  ["Tunde Bakare", "Africa/Lagos", ["Go", "Kubernetes", "Observability"], 2, 2, "Platform engineer", 0.95],
  ["Wanjiru Kamau", "Africa/Nairobi", ["Node.js", "TypeScript", "GraphQL"], 3, 2, "Backend lead, fintech", 1],
  ["Chidinma Eze", "Africa/Lagos", ["SQL", "Data engineering", "Airflow"], 2, 2, "Data engineer", 0.9],
  ["Kwame Mensah", "Africa/Accra", ["Java", "Spring", "System design"], 2, 1, "Senior engineer, logistics", 0.85],
  ["Priya Raghunathan", "Europe/London", ["AWS", "Terraform", "Reliability"], 2, 3, "SRE, over capacity", 1],
  ["Ifeoma Nwosu", "Africa/Lagos", ["Security", "Threat modelling"], 1, 1, "Application security", 0.8],
  ["Samuel Adeyemi", "Africa/Lagos", ["Django", "PostgreSQL"], 2, 0, "Backend engineer", 0.7],
];

// name, timezone, skills, band, completeness
type MenteeSeed = [string, string, string[], S["PriorityBand"], number];

const MENTEES: MenteeSeed[] = [
  ["Blessing Adewale", "Africa/Lagos", ["Python", "Flask"], "high", 0.9],
  ["Ngozi Obi", "Africa/Lagos", ["JavaScript", "React"], "medium", 0.85],
  ["Fatima Yusuf", "Africa/Kano", ["Python"], "high", 0.6],
  ["David Otieno", "Africa/Nairobi", ["Node.js", "Express"], "medium", 0.8],
  ["Grace Mwangi", "Africa/Nairobi", ["Java"], "low", 0.95],
  ["Emeka Nnamdi", "Africa/Lagos", ["Go", "Docker"], "medium", 0.75],
  ["Aisha Bello", "Africa/Lagos", ["SQL", "Python"], "high", 0.55],
  ["Joy Achieng", "Africa/Nairobi", ["TypeScript"], "low", 0.9],
  ["Tobi Salami", "Africa/Lagos", ["Python", "Django"], "medium", 0.8],
  ["Halima Sani", "Africa/Kano", ["HTML", "CSS"], "high", 0.4],
  ["Chinedu Okafor", "Africa/Lagos", ["Java", "Spring"], "low", 0.85],
  ["Zainab Musa", "Africa/Lagos", ["Python", "Pandas"], "high", 0.65],
  ["Peter Kimani", "Africa/Nairobi", ["Kubernetes"], "medium", 0.9],
  ["Adaeze Ugo", "Africa/Lagos", ["TypeScript", "Node.js"], "medium", 0.88],
  ["Yusuf Ibrahim", "Africa/Kano", ["Python"], "high", 0.35],
  ["Lerato Molefe", "Africa/Johannesburg", ["Go"], "low", 0.7],
];

const mentorEntries: S["RosterEntry"][] = MENTORS.map(
  ([name, timezone, , capacity, load, , completeness], i) => ({
    id: participation(i + 1),
    account: {
      id: account(i + 1),
      name,
      email: `${name.toLowerCase().replace(/ /g, ".")}@example.org`,
      emailVerified: true,
      photoUrl: null,
    },
    role: "mentor",
    status: "approved",
    matched: load > 0,
    capacity,
    load,
    profileCompleteness: completeness,
    timezone,
    joinedAt: daysAgo(60 - i),
  }),
);

const menteeEntries: S["RosterEntry"][] = MENTEES.map(
  ([name, timezone, , , completeness], i) => ({
    id: participation(100 + i + 1),
    account: {
      id: account(100 + i + 1),
      name,
      email: `${name.toLowerCase().replace(/ /g, ".")}@example.org`,
      emailVerified: i % 7 !== 0,
      photoUrl: null,
    },
    role: "mentee",
    status: i >= 14 ? "waitlisted" : "approved",
    matched: i < 14,
    capacity: null,
    load: null,
    profileCompleteness: completeness,
    timezone,
    joinedAt: daysAgo(50 - i),
  }),
);

const mentorSkills = (i: number) => MENTORS[i][2];
const menteeSkills = (i: number) => MENTEES[i][2];

/** Mentee index -> mentor index. 14 of 16 mentees matched. */
const ASSIGNMENT: Array<[number, number, number]> = [
  // menteeIdx, mentorIdx, score
  [0, 0, 0.91],
  [1, 2, 0.84],
  [2, 0, 0.72],
  [3, 2, 0.8],
  [4, 4, 0.88],
  [5, 1, 0.86],
  [6, 3, 0.68],
  [7, 5, 0.83],
  [8, 0, 0.79],
  [9, 6, 0.57],
  [10, 4, 0.9],
  [11, 3, 0.74],
  [12, 1, 0.81],
  [13, 5, 0.76],
];

const draftPairs: S["DraftPair"][] = ASSIGNMENT.map(
  ([menteeIdx, mentorIdx, score], i) => ({
    id: pair(i + 1),
    mentee: {
      participationId: menteeEntries[menteeIdx].id,
      name: menteeEntries[menteeIdx].account.name,
      photoUrl: null,
    },
    mentor: {
      participationId: mentorEntries[mentorIdx].id,
      name: mentorEntries[mentorIdx].account.name,
      photoUrl: null,
    },
    score,
    priorityBand: MENTEES[menteeIdx][3],
  }),
);

const bandStat = (band: S["PriorityBand"]): S["PriorityBandStat"] => {
  const scores = ASSIGNMENT.filter(([m]) => MENTEES[m][3] === band).map(
    ([, , s]) => s,
  );
  const sorted = [...scores].sort((a, b) => a - b);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    band,
    menteeCount: scores.length,
    meanScore: Number(mean.toFixed(3)),
    medianScore: Number(median.toFixed(3)),
  };
};

const scoreDistribution: S["ScoreBucket"][] = [
  [0.5, 0.6],
  [0.6, 0.7],
  [0.7, 0.8],
  [0.8, 0.9],
  [0.9, 1.0],
].map(([rangeStart, rangeEnd]) => ({
  rangeStart,
  rangeEnd,
  count: ASSIGNMENT.filter(
    ([, , s]) => s >= rangeStart && (rangeEnd === 1 ? s <= 1 : s < rangeEnd),
  ).length,
}));

const fairnessSummary: S["FairnessSummary"] = {
  coverageRate: Number((ASSIGNMENT.length / MENTEES.length).toFixed(4)),
  matchedCount: ASSIGNMENT.length,
  unmatchedCount: MENTEES.length - ASSIGNMENT.length,
  totalMentees: MENTEES.length,
  mentorLoad: MENTORS.map(([, , , capacity, load], i) => ({
    mentor: {
      participationId: mentorEntries[i].id,
      name: mentorEntries[i].account.name,
      photoUrl: null,
    },
    load,
    capacity,
  })),
  priorityBands: [bandStat("high"), bandStat("medium"), bandStat("low")],
  scoreDistribution,
};

const member = (
  entry: S["RosterEntry"],
  skills: string[],
  headline: string,
): S["StrandMember"] => ({
  participationId: entry.id,
  name: entry.account.name,
  role: entry.role,
  headline,
  photoUrl: null,
  timezone: entry.timezone,
  skills,
});

/** The signed-in account: mentor with three strands, and coordinator on this
 *  program so every route in the slice is reachable from one session. */
const ME_INDEX = 0;
const me = mentorEntries[ME_INDEX];

const meMember = member(me, mentorSkills(0), MENTORS[0][5]);

type StrandSeed = {
  n: number;
  menteeIdx: number;
  lastActivityDaysAgo: number;
  unread: number;
  nextSessionInDays: number | null;
  /** Omitted means active. An ended strand needs `endedDaysAgo` with it. */
  state?: S["StrandState"];
  endedDaysAgo?: number;
  messages: Array<[fromMe: boolean, daysAgo: number, body: string]>;
};

const STRAND_SEEDS: StrandSeed[] = [
  {
    n: 1,
    menteeIdx: 0,
    lastActivityDaysAgo: 1,
    unread: 2,
    nextSessionInDays: 4,
    messages: [
      [false, 21, "Hello Amara, thank you for taking me on. I have been building a small expense tracker in Flask."],
      [true, 21, "Good to meet you Blessing. Send me the repository when you get a chance and I will read through it before we talk."],
      [false, 20, "Shared it now. The part I am least sure about is how I structured the database layer."],
      [true, 18, "I read it. The structure is reasonable. What I would change first is moving the queries out of the route handlers, so the routes only handle the request and response."],
      [false, 14, "That made a real difference. Routes are about ten lines each now."],
      [true, 7, "Good. Next thing worth learning is writing a test for one of those functions. Pick the one you were most nervous about changing."],
      [false, 2, "Wrote three tests. One of them caught a bug where I was not handling an empty result."],
      [false, 1, "Also wanted to ask about how you decided to move into payments work."],
    ],
  },
  {
    n: 2,
    menteeIdx: 2,
    lastActivityDaysAgo: 5,
    unread: 0,
    nextSessionInDays: 11,
    messages: [
      [true, 19, "Hello Fatima. Before we meet, tell me what you are working on and what you would like to be doing in a year."],
      [false, 17, "I am learning Python on my own. In a year I want to be working as a backend engineer."],
      [true, 12, "That is a clear goal. Let us pick one project and take it further than feels comfortable, rather than starting several."],
      [false, 9, "Agreed. I will finish the library API I started."],
      [true, 5, "Send it over when the first endpoint works end to end."],
    ],
  },
  {
    n: 3,
    menteeIdx: 8,
    lastActivityDaysAgo: 23,
    unread: 0,
    nextSessionInDays: null,
    messages: [
      [true, 25, "Hello Tobi, looking forward to working together. What would be most useful to start with?"],
      [false, 23, "Thank you. I will come back with something specific this week."],
    ],
  },
  {
    n: 4,
    menteeIdx: 4,
    lastActivityDaysAgo: 40,
    unread: 0,
    nextSessionInDays: null,
    state: "ended",
    endedDaysAgo: 38,
    messages: [
      [true, 70, "Hello Grace. You said Java and system design. Which of the two is closer to what you need this month?"],
      [false, 68, "System design. I can write Java but I freeze when someone asks me how I would build something."],
      [true, 60, "Then we will draw. Every session, one system on paper before any code."],
      [false, 44, "Drew the ticketing one on my own this week and it held together."],
      [true, 41, "That is the cohort finished. You came in unable to start a diagram and you are now finishing them unprompted. Keep drawing."],
      [false, 40, "Thank you Amara. I will."],
    ],
  },
];

function buildStrands() {
  const strands: S["Strand"][] = [];
  const summaries: S["StrandSummary"][] = [];
  const messages: Record<string, S["Message"][]> = {};

  for (const seed of STRAND_SEEDS) {
    const id = strand(seed.n);
    const menteeEntry = menteeEntries[seed.menteeIdx];
    const partner = member(
      menteeEntry,
      menteeSkills(seed.menteeIdx),
      "Mentee",
    );

    const thread: S["Message"][] = seed.messages.map(
      ([fromMe, ago, body], i) => ({
        id: message(seed.n * 100 + i + 1),
        strandId: id,
        author: fromMe
          ? { participationId: me.id, name: me.account.name, photoUrl: null }
          : {
              participationId: menteeEntry.id,
              name: menteeEntry.account.name,
              photoUrl: null,
            },
        body,
        sentAt: daysAgo(ago),
        deliveryState: "delivered",
        clientToken: null,
      }),
    );

    messages[id] = thread;
    const last = thread[thread.length - 1];
    const state = seed.state ?? "active";
    const endedAt =
      seed.endedDaysAgo === undefined ? null : daysAgo(seed.endedDaysAgo);

    strands.push({
      id,
      programId: PROGRAM,
      state,
      originMode: "batch",
      members: [meMember, partner],
      matchRationale: `Matched on a shared focus in ${menteeSkills(seed.menteeIdx)[0]} and backend fundamentals, with a two-hour timezone overlap. This names the strongest signals; in a whole-cohort assignment the outcome also depends on who else was available.`,
      createdAt: daysAgo(Math.max(...seed.messages.map(([, ago]) => ago)) + 2),
      endedAt,
    });

    summaries.push({
      id,
      programId: PROGRAM,
      state,
      originMode: "batch",
      members: [partner],
      lastMessage: {
        authorName: last.author.name,
        body: last.body,
        sentAt: last.sentAt,
      },
      lastActivityAt: daysAgo(seed.lastActivityDaysAgo),
      unreadCount: seed.unread,
      nextSessionAt:
        seed.nextSessionInDays === null
          ? null
          : daysAhead(seed.nextSessionInDays),
      endedAt,
    });
  }

  return { strands, summaries, messages };
}

export function createDb() {
  const { strands, summaries, messages } = buildStrands();

  const program: S["ProgramPublic"] = {
    id: PROGRAM,
    slug: PROGRAM_SLUG,
    name: "Backend mentoring, cohort 4",
    organisation,
    description:
      "A six-month structured mentoring programme pairing early-career backend engineers with senior engineers across Africa and the UK. Pairs meet twice a month and work towards one substantial project.",
    state: "open",
    cohortStart: "2026-09-14",
    cohortEnd: "2027-03-14",
    applicationsCloseAt: daysAhead(21),
    matchingOpensAt: daysAhead(37),
    timeCommitment: "About two hours a month for six months.",
    eligibility:
      "Open to women and non-binary engineers with less than three years of professional experience. Mentors need at least five years.",
    openRoles: ["mentee", "mentor"],
    mentorCount: MENTORS.length,
    menteeCount: MENTEES.length,
  };

  const runs: S["RunDetail"][] = [
    {
      id: uuid(6, 1),
      programId: PROGRAM,
      state: "published",
      progress: 1,
      recipeVersion: 2,
      createdAt: daysAgo(24),
      createdBy: "Amara Okonkwo",
      publishedAt: daysAgo(24),
      publishedBy: "Amara Okonkwo",
      draftedCount: 11,
      publishedCount: 11,
      coverageRate: 0.6875,
      fairnessSummary: null,
      pairs: [],
      unmatchedCount: 5,
    },
    {
      id: uuid(6, 2),
      programId: PROGRAM,
      state: "discarded",
      progress: 1,
      recipeVersion: 3,
      createdAt: daysAgo(10),
      createdBy: "Amara Okonkwo",
      publishedAt: null,
      publishedBy: null,
      draftedCount: 12,
      publishedCount: 0,
      coverageRate: 0.75,
      fairnessSummary: null,
      pairs: [],
      unmatchedCount: 4,
    },
    {
      id: uuid(6, 3),
      programId: PROGRAM,
      state: "drafted",
      progress: 1,
      recipeVersion: 4,
      createdAt: daysAgo(1),
      createdBy: "Amara Okonkwo",
      publishedAt: null,
      publishedBy: null,
      draftedCount: draftPairs.length,
      publishedCount: 0,
      coverageRate: fairnessSummary.coverageRate,
      fairnessSummary,
      pairs: draftPairs,
      unmatchedCount: fairnessSummary.unmatchedCount,
    },
  ];

  const applications: S["Application"][] = [
    {
      id: uuid(5, 1),
      programId: PROGRAM,
      programName: program.name,
      role: "mentee",
      name: "Halima Sani",
      email: "halima.sani@example.org",
      status: "submitted",
      submittedAt: daysAgo(2),
      editableUntil: daysAhead(21),
      matchingOpensAt: daysAhead(37),
      answers: {
        goal: "I want to move from building small scripts to shipping a real backend service.",
        years_experience: 1,
        skills: ["Python", "HTML", "CSS"],
        timezone: "Africa/Kano",
        consent_share_demographics: true,
      },
    },
  ];

  const session: S["Session"] = {
    account: me.account,
    participations: [
      {
        id: me.id,
        programId: PROGRAM,
        programName: program.name,
        organisationName: organisation.name,
        orgSlug: ORG_SLUG,
        programSlug: PROGRAM_SLUG,
        role: "mentor",
        status: "approved",
        isCoordinator: true,
      },
      // Role lives on the participation, never the account: the same person is
      // a mentor here and a mentee elsewhere. Only the programme switcher and
      // the guards read this one — it has no roster, runs or strands behind it.
      {
        id: participation(900),
        programId: uuid(2, 2),
        programName: "Research writing, 2026",
        organisationName: "University of Lagos",
        orgSlug: "unilag",
        programSlug: "research-writing-2026",
        role: "mentee",
        status: "approved",
        isCoordinator: false,
      },
    ],
  };

  return {
    organisation,
    program,
    roster: [...mentorEntries, ...menteeEntries],
    runs,
    strands,
    strandSummaries: summaries,
    messages,
    applications,
    session,
    /** Tokens handed out by POST /auth/magic-link, consumed by /auth/verify. */
    magicLinkTokens: new Set<string>(["valid-token"]),
    signedIn: true,
    seq: 1000,
  };
}

export type Db = ReturnType<typeof createDb>;

export let db: Db = createDb();

export function resetDb() {
  db = createDb();
}
