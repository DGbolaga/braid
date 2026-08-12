import { HttpResponse, http } from "msw";
import type { components } from "../types";
import { ORG_SLUG, PROGRAM_ID, PROGRAM_SLUG, db } from "./fixtures";

type S = components["schemas"];

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/v1";
const url = (path: string) => `${BASE}${path}`;

const problem = (status: number, code: string, message: string) =>
  HttpResponse.json<S["Problem"]>({ code, message }, { status });

const unauthorized = () =>
  problem(401, "no_session", "Sign in to continue.");
const notFound = (what: string) =>
  problem(404, "not_found", `No such ${what}.`);

const requireSession = () => (db.signedIn ? null : unauthorized());

const nextId = (kind: number) =>
  `${String(kind).padStart(8, "0")}-0000-4000-8000-${String(++db.seq).padStart(12, "0")}`;

const DECISION_STATUS: Record<string, S["ApplicationStatus"] | undefined> = {
  approve: "approved",
  waitlist: "waitlisted",
  reject: "rejected",
};

/** One way in this slice. Nothing un-decides an application. */
const DECIDED = new Set<S["ApplicationStatus"]>([
  "approved",
  "waitlisted",
  "rejected",
]);

/**
 * Completeness is answered over askable, for the version actually answered.
 * Computed rather than stored so it cannot disagree with the answers beside it.
 */
function completenessOf(application: S["Application"]) {
  const version = db.formVersions.find(
    (v) => v.id === application.formVersionId,
  );
  const askable = version
    ? version.sections.flatMap((s) => s.fields).length
    : Object.keys(application.answers).length;
  if (askable === 0) return 1;
  return Number(
    (Object.keys(application.answers).length / askable).toFixed(3),
  );
}

function flagsOf(application: S["Application"]): S["ApplicationFlag"][] {
  const flags: S["ApplicationFlag"][] = [];
  if (completenessOf(application) < 0.6) flags.push("incomplete");
  if (
    db.applications.some(
      (a) => a.id !== application.id && a.email === application.email,
    )
  ) {
    flags.push("duplicate_email");
  }
  if (db.roster.some((r) => r.account.email === application.email)) {
    flags.push("reapplied");
  }
  return flags;
}

const toSummary = (a: S["Application"]): S["ApplicationSummary"] => ({
  id: a.id,
  programId: a.programId,
  role: a.role,
  name: a.name,
  email: a.email,
  status: a.status,
  submittedAt: a.submittedAt,
  decidedAt: a.decidedAt ?? null,
  decidedBy: a.decidedBy ?? null,
  completeness: completenessOf(a),
  flags: flagsOf(a),
});

/**
 * Approving is the only decision that changes anything beyond the application:
 * it puts a person on the roster, which is the whole point of the queue.
 */
function decide(
  application: S["Application"],
  status: S["ApplicationStatus"],
) {
  application.status = status;
  application.decidedAt = new Date().toISOString();
  application.decidedBy = db.session.account.name;

  if (status !== "approved") return;
  if (db.roster.some((r) => r.account.email === application.email)) return;

  db.roster.push({
    id: nextId(4),
    account: {
      id: nextId(3),
      name: application.name,
      email: application.email,
      emailVerified: true,
      photoUrl: null,
    },
    role: application.role,
    status: "approved",
    matched: false,
    capacity: application.role === "mentor" ? 2 : null,
    load: application.role === "mentor" ? 0 : null,
    profileCompleteness: completenessOf(application),
    timezone: null,
    joinedAt: new Date().toISOString(),
  });
}

/** Runs advance one step per read, so polling has something to observe. */
const RUN_STEPS = [0.15, 0.45, 0.8, 1];

function advanceRun(run: S["RunDetail"]) {
  if (run.state !== "queued" && run.state !== "running") return;
  const i = RUN_STEPS.indexOf(run.progress);
  const next = RUN_STEPS[i + 1] ?? 1;
  run.progress = next;
  run.state = next < 1 ? "running" : "drafted";

  if (run.state === "drafted") {
    const template = db.runs.find((r) => r.fairnessSummary !== null);
    if (template) {
      run.fairnessSummary = template.fairnessSummary;
      run.pairs = template.pairs;
      run.draftedCount = template.pairs.length;
      run.unmatchedCount = template.unmatchedCount;
      run.coverageRate = template.coverageRate;
    }
  }
}

export const handlers = [
  http.get(url("/orgs/:orgSlug/programs/:programSlug"), ({ params }) => {
    if (params.orgSlug !== ORG_SLUG || params.programSlug !== PROGRAM_SLUG) {
      return notFound("program");
    }
    return HttpResponse.json(db.program);
  }),

  http.get(
    url("/orgs/:orgSlug/programs/:programSlug/form-schema"),
    ({ params, request }) => {
      if (params.orgSlug !== ORG_SLUG || params.programSlug !== PROGRAM_SLUG) {
        return notFound("program");
      }
      const role = new URL(request.url).searchParams.get("role");
      const found = db.formVersions.find(
        (v) => v.role === role && v.publishedAt !== null,
      );
      return found
        ? HttpResponse.json(found)
        : problem(
            404,
            "no_published_form",
            "This programme has no published form for that role yet.",
          );
    },
  ),

  http.post(
    url("/orgs/:orgSlug/programs/:programSlug/waitlist"),
    async ({ params, request }) => {
      if (params.orgSlug !== ORG_SLUG || params.programSlug !== PROGRAM_SLUG) {
        return notFound("program");
      }
      const body = (await request.json()) as { email?: string; role?: S["Role"] };
      if (!body?.email?.includes("@")) {
        return problem(400, "invalid_email", "Enter a valid email address.");
      }
      db.waitlist.push({ email: body.email, role: body.role });
      return new HttpResponse(null, { status: 202 });
    },
  ),

  http.get(
    url("/orgs/:orgSlug/programs/:programSlug/application-draft"),
    ({ params, request }) => {
      if (params.orgSlug !== ORG_SLUG || params.programSlug !== PROGRAM_SLUG) {
        return notFound("program");
      }
      const draftId = new URL(request.url).searchParams.get("draftId");
      const found = db.drafts.find((d) => d.draftId === draftId);
      return found ? HttpResponse.json(found) : notFound("draft");
    },
  ),

  http.put(
    url("/orgs/:orgSlug/programs/:programSlug/application-draft"),
    async ({ params, request }) => {
      if (params.orgSlug !== ORG_SLUG || params.programSlug !== PROGRAM_SLUG) {
        return notFound("program");
      }
      if (db.program.state === "closed" || db.program.state === "full") {
        return problem(409, "applications_closed", "Applications have closed for this programme.");
      }
      const body = (await request.json()) as S["ApplicationDraftSave"];
      const now = new Date().toISOString();
      const answers: S["ApplicationDraft"]["answers"] = {};
      for (const [fieldId, answer] of Object.entries(body.answers ?? {})) {
        answers[fieldId] = { ...answer, answeredAt: now };
      }

      const existing = db.drafts.find((d) => d.draftId === body.draftId);
      if (existing) {
        existing.answers = answers;
        existing.savedAt = now;
        return HttpResponse.json(existing);
      }

      const created: S["ApplicationDraft"] = {
        draftId: nextId(13),
        role: body.role,
        formVersionId: body.formVersionId,
        answers,
        savedAt: now,
      };
      db.drafts.push(created);
      return HttpResponse.json(created);
    },
  ),

  http.post(
    url("/orgs/:orgSlug/programs/:programSlug/applications"),
    async ({ params, request }) => {
      if (params.orgSlug !== ORG_SLUG || params.programSlug !== PROGRAM_SLUG) {
        return notFound("program");
      }
      const body = (await request.json()) as S["ApplicationCreate"];
      if (!body?.email || !body?.name || !body?.role) {
        return problem(400, "invalid_body", "Name, email and role are required.");
      }
      if (db.program.state === "closed") {
        return problem(409, "applications_closed", "Applications have closed for this programme.");
      }
      if (db.applications.some((a) => a.email === body.email)) {
        return problem(409, "already_applied", "An application already exists for this email address.");
      }
      const version = db.formVersions.find((v) => v.id === body.formVersionId);
      if (!version || version.role !== body.role) {
        return problem(
          409,
          "stale_form_version",
          "The form has changed since you started. Reload to see the current questions.",
        );
      }

      // The client asserts provenance; the server owns the clock.
      const now = new Date().toISOString();
      const answers: S["Application"]["answers"] = {};
      for (const [fieldId, answer] of Object.entries(body.answers ?? {})) {
        answers[fieldId] = { ...answer, answeredAt: now };
      }

      const created: S["Application"] = {
        id: nextId(5),
        programId: PROGRAM_ID,
        programName: db.program.name,
        role: body.role,
        name: body.name,
        email: body.email,
        status: "submitted",
        submittedAt: new Date().toISOString(),
        editableUntil: db.program.applicationsCloseAt,
        matchingOpensAt: db.program.matchingOpensAt,
        formVersionId: version.id,
        answers,
      };
      db.applications.push(created);
      return HttpResponse.json(created, { status: 201 });
    },
  ),

  http.get(url("/applications/:applicationId"), ({ params }) => {
    const found = db.applications.find((a) => a.id === params.applicationId);
    return found ? HttpResponse.json(found) : notFound("application");
  }),

  http.post(url("/auth/magic-link"), async ({ request }) => {
    const body = (await request.json()) as S["MagicLinkRequest"];
    if (!body?.email?.includes("@")) {
      return problem(400, "invalid_email", "Enter a valid email address.");
    }
    // Issued only for known accounts, but the response never reveals which.
    const known = db.roster.some((r) => r.account.email === body.email);
    if (known) db.magicLinkTokens.add(`token-for-${body.email}`);
    return new HttpResponse(null, { status: 202 });
  }),

  http.post(url("/auth/verify"), async ({ request }) => {
    const body = (await request.json()) as S["VerifyRequest"];
    if (!body?.token) {
      return problem(400, "invalid_body", "A token is required.");
    }
    if (!db.magicLinkTokens.has(body.token)) {
      return problem(410, "token_spent", "That link has expired or was already used.");
    }
    db.magicLinkTokens.delete(body.token);
    db.signedIn = true;
    return HttpResponse.json(db.session, {
      status: 200,
      headers: {
        "Set-Cookie": "braid_session=mock; HttpOnly; SameSite=Lax; Path=/",
      },
    });
  }),

  http.post(url("/auth/signout"), () => {
    db.signedIn = false;
    return new HttpResponse(null, {
      status: 204,
      headers: {
        "Set-Cookie":
          "braid_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
      },
    });
  }),

  http.get(url("/auth/session"), () => {
    return db.signedIn ? HttpResponse.json(db.session) : unauthorized();
  }),

  http.get(url("/programs/:programId/home"), ({ params }) => {
    const denied = requireSession();
    if (denied) return denied;
    if (params.programId !== PROGRAM_ID) return notFound("program");
    return HttpResponse.json(db.home);
  }),

  http.get(url("/programs/:programId/roster"), ({ params, request }) => {
    const denied = requireSession();
    if (denied) return denied;
    if (params.programId !== PROGRAM_ID) return notFound("programme");

    const q = new URL(request.url).searchParams;
    const role = q.get("role");
    const status = q.get("status");
    const matched = q.get("matched");
    const page = Number(q.get("page") ?? 1);
    const pageSize = Number(q.get("pageSize") ?? 25);

    const filtered = db.roster.filter(
      (r) =>
        (!role || r.role === role) &&
        (!status || r.status === status) &&
        (matched === null || r.matched === (matched === "true")),
    );

    const body: S["RosterPage"] = {
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: filtered.length,
    };
    return HttpResponse.json(body);
  }),

  http.get(url("/programs/:programId/applications"), ({ params, request }) => {
    const denied = requireSession();
    if (denied) return denied;
    if (params.programId !== PROGRAM_ID) return notFound("programme");

    const q = new URL(request.url).searchParams;
    const status = q.get("status");
    const role = q.get("role");
    const page = Number(q.get("page") ?? 1);
    const pageSize = Number(q.get("pageSize") ?? 25);

    const all = db.applications.filter((a) => a.programId === PROGRAM_ID);
    const filtered = all.filter(
      (a) => (!status || a.status === status) && (!role || a.role === role),
    );

    // Newest first: the queue is read top down and today's intake is the work.
    const ordered = [...filtered].sort((a, b) =>
      b.submittedAt.localeCompare(a.submittedAt),
    );

    const body: S["ApplicationPage"] = {
      items: ordered
        .slice((page - 1) * pageSize, page * pageSize)
        .map(toSummary),
      page,
      pageSize,
      total: ordered.length,
      // Counts describe the whole queue, not the filtered view, so the tabs
      // do not change their own numbers when one is selected.
      counts: {
        submitted: all.filter((a) => a.status === "submitted").length,
        under_review: all.filter((a) => a.status === "under_review").length,
        approved: all.filter((a) => a.status === "approved").length,
        waitlisted: all.filter((a) => a.status === "waitlisted").length,
        rejected: all.filter((a) => a.status === "rejected").length,
      },
    };
    return HttpResponse.json(body);
  }),

  http.post(url("/applications/:applicationId/decision"), async ({ params, request }) => {
    const denied = requireSession();
    if (denied) return denied;

    const application = db.applications.find(
      (a) => a.id === params.applicationId,
    );
    if (!application) return notFound("application");

    const body = (await request.json()) as S["ApplicationDecision"];
    const outcome = DECISION_STATUS[body?.decision];
    if (!outcome) {
      return problem(400, "invalid_decision", "Choose approve, waitlist or reject.");
    }
    if (DECIDED.has(application.status)) {
      return problem(
        409,
        "already_decided",
        `This application was already ${application.status}.`,
      );
    }

    decide(application, outcome);
    return HttpResponse.json(application);
  }),

  http.post(
    url("/programs/:programId/applications/decisions"),
    async ({ params, request }) => {
      const denied = requireSession();
      if (denied) return denied;
      if (params.programId !== PROGRAM_ID) return notFound("programme");

      const body = (await request.json()) as S["BulkDecision"];
      const outcome = DECISION_STATUS[body?.decision];
      if (!outcome || !Array.isArray(body?.applicationIds)) {
        return problem(400, "invalid_body", "Choose a decision and at least one application.");
      }

      const skipped: S["SkippedDecision"][] = [];
      let decided = 0;

      for (const id of body.applicationIds) {
        const application = db.applications.find((a) => a.id === id);
        if (!application) {
          skipped.push({ applicationId: id, reason: "No such application." });
          continue;
        }
        if (DECIDED.has(application.status)) {
          skipped.push({
            applicationId: id,
            reason: `Already ${application.status}.`,
          });
          continue;
        }
        decide(application, outcome);
        decided += 1;
      }

      const result: S["BulkDecisionResult"] = { decided, skipped };
      return HttpResponse.json(result);
    },
  ),

  http.get(url("/form-versions/:formVersionId"), ({ params }) => {
    const denied = requireSession();
    if (denied) return denied;
    const found = db.formVersions.find((v) => v.id === params.formVersionId);
    return found ? HttpResponse.json(found) : notFound("form version");
  }),

  http.get(url("/programs/:programId/unmatched"), ({ params, request }) => {
    const denied = requireSession();
    if (denied) return denied;
    if (params.programId !== PROGRAM_ID) return notFound("programme");

    const q = new URL(request.url).searchParams;
    const reason = q.get("reason");
    const page = Number(q.get("page") ?? 1);
    const pageSize = Number(q.get("pageSize") ?? 25);

    const filtered = db.unmatched.filter((u) => !reason || u.reason === reason);

    const body: S["UnmatchedPage"] = {
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: filtered.length,
      availableMentors: db.roster
        .filter(
          (r) =>
            r.role === "mentor" &&
            r.capacity !== null &&
            r.capacity !== undefined &&
            (r.load ?? 0) < r.capacity,
        )
        .map((r) => ({
          participationId: r.id,
          name: r.account.name,
          load: r.load ?? 0,
          capacity: r.capacity ?? 0,
          skills: [],
          timezone: r.timezone,
        })),
    };
    return HttpResponse.json(body);
  }),

  http.post(url("/programs/:programId/strands"), async ({ params, request }) => {
    const denied = requireSession();
    if (denied) return denied;
    if (params.programId !== PROGRAM_ID) return notFound("programme");

    const body = (await request.json()) as S["StrandCreate"];
    const mentee = db.roster.find(
      (r) => r.id === body?.menteeParticipationId && r.role === "mentee",
    );
    const mentor = db.roster.find(
      (r) => r.id === body?.mentorParticipationId && r.role === "mentor",
    );
    if (!mentee || !mentor) return notFound("participant");

    if (mentor.capacity !== null && (mentor.load ?? 0) >= (mentor.capacity ?? 0)) {
      return problem(
        409,
        "mentor_full",
        `${mentor.account.name} is already at the capacity they set.`,
      );
    }
    if (mentee.matched) {
      return problem(
        409,
        "already_matched",
        `${mentee.account.name} already holds a strand.`,
      );
    }

    const now = new Date().toISOString();
    const created: S["Strand"] = {
      id: nextId(8),
      programId: PROGRAM_ID,
      state: "active",
      // Manual, per architecture 1: reports have to be able to tell a
      // coordinator's hand-pick from the algorithm's.
      originMode: "manual",
      createdAt: now,
      endedAt: null,
      // Honest about its own provenance. No score produced this pair, so it
      // does not get a sentence that sounds like one did.
      matchRationale: `Paired by ${db.session.account.name} from the unmatched queue.`,
      members: [
        {
          participationId: mentee.id,
          name: mentee.account.name,
          role: "mentee",
          photoUrl: null,
          headline: null,
          skills: [],
          timezone: mentee.timezone ?? null,
        },
        {
          participationId: mentor.id,
          name: mentor.account.name,
          role: "mentor",
          photoUrl: null,
          headline: null,
          skills: [],
          timezone: mentor.timezone ?? null,
        },
      ],
    };

    db.strands.push(created);
    mentee.matched = true;
    mentor.load = (mentor.load ?? 0) + 1;
    // Both leave the queue: the mentee now holds a strand, and the mentor is
    // no longer sitting at zero.
    db.unmatched = db.unmatched.filter(
      (u) => u.participationId !== mentee.id && u.participationId !== mentor.id,
    );

    return HttpResponse.json(created, { status: 201 });
  }),

  http.get(url("/programs/:programId/runs"), ({ params, request }) => {
    const denied = requireSession();
    if (denied) return denied;
    if (params.programId !== PROGRAM_ID) return notFound("programme");

    const q = new URL(request.url).searchParams;
    const page = Number(q.get("page") ?? 1);
    const pageSize = Number(q.get("pageSize") ?? 25);

    const ordered = [...db.runs].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    // The list view carries no pairs or fairness summary.
    const items: S["Run"][] = ordered.map((r) => ({
      id: r.id,
      programId: r.programId,
      state: r.state,
      progress: r.progress,
      recipeVersion: r.recipeVersion,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
      publishedAt: r.publishedAt,
      publishedBy: r.publishedBy,
      draftedCount: r.draftedCount,
      publishedCount: r.publishedCount,
      coverageRate: r.coverageRate,
    }));

    const body: S["RunPage"] = {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: items.length,
    };
    return HttpResponse.json(body);
  }),

  http.post(url("/programs/:programId/runs"), ({ params }) => {
    const denied = requireSession();
    if (denied) return denied;
    if (params.programId !== PROGRAM_ID) return notFound("programme");

    if (db.runs.some((r) => r.state === "queued" || r.state === "running")) {
      return problem(409, "run_in_progress", "A matching run is already in progress.");
    }

    const created: S["RunDetail"] = {
      id: nextId(6),
      programId: PROGRAM_ID,
      state: "queued",
      progress: RUN_STEPS[0],
      recipeVersion: 4,
      createdAt: new Date().toISOString(),
      createdBy: db.session.account.name,
      publishedAt: null,
      publishedBy: null,
      draftedCount: 0,
      publishedCount: 0,
      coverageRate: null,
      fairnessSummary: null,
      pairs: [],
      unmatchedCount: 0,
    };
    db.runs.push(created);
    return HttpResponse.json(created, { status: 202 });
  }),

  http.get(url("/runs/:runId"), ({ params }) => {
    const denied = requireSession();
    if (denied) return denied;
    const run = db.runs.find((r) => r.id === params.runId);
    if (!run) return notFound("run");
    advanceRun(run);
    return HttpResponse.json(run);
  }),

  http.post(url("/runs/:runId/publish"), ({ params }) => {
    const denied = requireSession();
    if (denied) return denied;
    const run = db.runs.find((r) => r.id === params.runId);
    if (!run) return notFound("run");

    if (run.state !== "drafted") {
      return problem(
        409,
        "not_publishable",
        `A run can only be published from drafted. This one is ${run.state}.`,
      );
    }

    run.state = "published";
    run.publishedAt = new Date().toISOString();
    run.publishedBy = db.session.account.name;
    run.publishedCount = run.pairs.length;
    return HttpResponse.json(run);
  }),

  http.get(url("/programs/:programId/strands"), ({ params, request }) => {
    const denied = requireSession();
    if (denied) return denied;
    if (params.programId !== PROGRAM_ID) return notFound("programme");

    const state = new URL(request.url).searchParams.get("state");
    const items = db.strandSummaries.filter((s) => !state || s.state === state);
    return HttpResponse.json(items);
  }),

  http.get(url("/strands/:strandId"), ({ params }) => {
    const denied = requireSession();
    if (denied) return denied;
    const found = db.strands.find((s) => s.id === params.strandId);
    return found ? HttpResponse.json(found) : notFound("strand");
  }),

  http.get(url("/strands/:strandId/messages"), ({ params, request }) => {
    const denied = requireSession();
    if (denied) return denied;
    const id = String(params.strandId);
    const thread = db.messages[id];
    if (!thread) return notFound("strand");

    const q = new URL(request.url).searchParams;
    const limit = Number(q.get("limit") ?? 50);
    const before = q.get("before");

    const end = before ? thread.findIndex((m) => m.id === before) : thread.length;
    const start = Math.max(0, end - limit);

    const body: S["MessagePage"] = {
      items: thread.slice(start, end),
      nextCursor: start > 0 ? thread[start].id : null,
    };
    return HttpResponse.json(body);
  }),

  http.post(url("/strands/:strandId/messages"), async ({ params, request }) => {
    const denied = requireSession();
    if (denied) return denied;
    const id = String(params.strandId);
    const thread = db.messages[id];
    if (!thread) return notFound("strand");

    const body = (await request.json()) as S["MessageCreate"];
    if (!body?.body?.trim()) {
      return problem(400, "empty_message", "A message cannot be empty.");
    }

    const sender = db.strands
      .find((s) => s.id === id)
      ?.members.find((m) => m.participationId === db.session.participations[0].id);

    const created: S["Message"] = {
      id: nextId(9),
      strandId: id,
      author: {
        participationId: db.session.participations[0].id,
        name: sender?.name ?? db.session.account.name,
        photoUrl: null,
      },
      body: body.body,
      sentAt: new Date().toISOString(),
      deliveryState: "sent",
      clientToken: body.clientToken ?? null,
    };

    thread.push(created);

    const summary = db.strandSummaries.find((s) => s.id === id);
    if (summary) {
      summary.lastMessage = {
        authorName: created.author.name,
        body: created.body,
        sentAt: created.sentAt,
      };
      summary.lastActivityAt = created.sentAt;
    }

    return HttpResponse.json(created, { status: 201 });
  }),
];
