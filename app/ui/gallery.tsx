"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, TextareaField } from "@/components/ui/input";
import { DataTable, type Column, type SortState } from "@/components/ui/table";

type Person = { id: string; name: string; role: string; load: number; score: number };

const PEOPLE: Person[] = [
  { id: "p1", name: "Amara Okonkwo", role: "Mentor", load: 3, score: 0.91 },
  { id: "p2", name: "Blessing Adewale", role: "Mentee", load: 1, score: 0.84 },
  { id: "p3", name: "Wanjiru Kamau", role: "Mentor", load: 2, score: 0.8 },
  { id: "p4", name: "Fatima Yusuf", role: "Mentee", load: 1, score: 0.72 },
];

const COLUMNS: Array<Column<Person>> = [
  { key: "name", header: "Name", sortable: true, cell: (r) => r.name, csv: (r) => r.name },
  { key: "role", header: "Role", sortable: true, cell: (r) => r.role, csv: (r) => r.role },
  { key: "load", header: "Load", numeric: true, sortable: true, cell: (r) => r.load, csv: (r) => r.load },
  { key: "score", header: "Score", numeric: true, cell: (r) => r.score.toFixed(2), csv: (r) => r.score },
];

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-16">
      <div className="flex flex-col gap-4 border-b border-subtle pb-8">
        <span className="type-label text-muted">{n}</span>
        <h2 className="type-heading-m text-primary">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-16">
      <span className="w-96 shrink-0 type-caption text-muted">{label}</span>
      {children}
    </div>
  );
}

export function Gallery() {
  const [sort, setSort] = useState<SortState>({ key: "name", direction: "asc" });
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedDemo, setSelectedDemo] = useState<string[]>(["p1", "p2"]);

  return (
    <main className="mx-auto flex max-w-coordinator flex-col gap-64 bg-page px-32 py-48">
      <header className="flex flex-col gap-4">
        <span className="type-label text-muted">Development only</span>
        <h1 className="type-heading-l text-primary">ui/ primitives, every state</h1>
        <p className="type-body-m text-secondary">
          Not reachable in a production build. Change a primitive and check this
          page before checking the screen you were working on.
        </p>
      </header>

      <Section n="01" title="Button — variants and sizes">
        {(["primary", "secondary", "ghost", "danger"] as const).map((variant) => (
          <Row key={variant} label={variant}>
            <Button variant={variant} size="sm">Publish</Button>
            <Button variant={variant} size="md">Publish</Button>
            <Button variant={variant} size="lg">Publish</Button>
          </Row>
        ))}
      </Section>

      <Section n="02" title="Button — states">
        <Row label="default"><Button>Say hello</Button></Row>
        <Row label="hover"><Button className="bg-accent-hover">Say hello</Button></Row>
        <Row label="focus"><Button autoFocus>Say hello</Button></Row>
        <Row label="active"><Button className="scale-98">Say hello</Button></Row>
        <Row label="disabled">
          <Button disabled>Say hello</Button>
          <Button variant="secondary" disabled>Say hello</Button>
          <Button variant="ghost" disabled>Say hello</Button>
          <Button variant="danger" disabled>Say hello</Button>
        </Row>
        <Row label="loading">
          <Button loading loadingLabel="Publishing">Publish 42 strands</Button>
          <Button variant="secondary" loading loadingLabel="Saving">Save</Button>
        </Row>
        <Row label="width held">
          <span className="flex flex-col gap-4">
            <Button id="btn-idle">Publish 42 strands</Button>
            <Button id="btn-loading" loading>Publish 42 strands</Button>
          </span>
        </Row>
      </Section>

      <Section n="03" title="Form field — states">
        <div className="grid max-w-participant gap-24 md:grid-cols-2">
          <Field label="Full name" placeholder="Amara Okonkwo" />
          <Field label="Full name" defaultValue="Amara Okonkwo" helper="As it appears on your certificate." />
          <Field label="Email address" required helper="We send the magic link here." />
          <Field label="Phone number" mark="optional" />
          <Field label="Cohort" defaultValue="Backend cohort 4" disabled />
          <Field
            label="Start date"
            defaultValue="2026-08-01"
            error="Enter a date after 14 September."
          />
          <TextareaField
            label="Why do you want a mentor?"
            helper="Two or three sentences is plenty."
          />
          <TextareaField
            label="What went wrong"
            error="Say what happened so a coordinator can act on it."
          />
        </div>
      </Section>

      <Section n="04" title="Data table — default, sortable, selectable">
        <DataTable
          caption="Roster of participants"
          columns={COLUMNS}
          rows={PEOPLE}
          getRowId={(r) => r.id}
          filters={<span className="type-body-s text-muted">Filter slot</span>}
          sort={sort}
          onSortChange={setSort}
          selectable
          selectedIds={selected}
          onSelectionChange={setSelected}
          bulkActions={(ids) => (
            <>
              <Button size="sm" variant="secondary">Message {ids.length}</Button>
              <Button size="sm" variant="ghost">Change role</Button>
            </>
          )}
          csvFileName="roster.csv"
        />
      </Section>

      <Section n="05" title="Data table — selection replaces the header row">
        <DataTable
          caption="Roster with a live selection"
          columns={COLUMNS}
          rows={PEOPLE}
          getRowId={(r) => r.id}
          filters={null}
          selectable
          selectedIds={selectedDemo}
          onSelectionChange={setSelectedDemo}
          bulkActions={() => (
            <Button size="sm" variant="secondary">Message selected</Button>
          )}
        />
      </Section>

      <Section n="06" title="Data table — loading, error, empty">
        <DataTable caption="Loading" columns={COLUMNS} rows={[]} getRowId={(r) => r.id} filters={null} loading />
        <DataTable
          caption="Error"
          columns={COLUMNS}
          rows={[]}
          getRowId={(r) => r.id}
          filters={null}
          error="The roster did not load."
          onRetry={() => undefined}
        />
        <DataTable caption="Empty" columns={COLUMNS} rows={[]} getRowId={(r) => r.id} filters={null} />
      </Section>

      <Section n="07" title="Empty state">
        <div className="rounded-md border border-subtle bg-surface">
          <EmptyState
            markId="es-1"
            title="No strands yet"
            body="When matching runs on 14 September your strand will appear here."
            action={<Button variant="secondary">Finish your profile</Button>}
          />
        </div>
        <div className="rounded-md border border-subtle bg-surface">
          <EmptyState
            markId="es-2"
            emphasis="display"
            title="Matching opens 14 September."
            body="Twelve mentors have joined so far. Finish your profile before then and you'll be included in the first round."
            action={<Button>Finish your profile</Button>}
          />
        </div>
        <div className="rounded-md border border-subtle bg-surface">
          <EmptyState markId="es-3" title="No results" body="No one matches those filters." />
        </div>
      </Section>
    </main>
  );
}
