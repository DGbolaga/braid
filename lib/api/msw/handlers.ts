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
