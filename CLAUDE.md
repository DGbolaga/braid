# CLAUDE.md

Rules for working in this repository. Read before any task. These are constraints, not preferences.

## What this is

Braid, a mentoring platform. Next.js frontend, FastAPI backend in a separate repo. This repo is frontend only.

Reference docs, read the relevant one before building:

- `docs/architecture.md` — pages, routes, what each screen does
- `docs/design-direction.md` — tokens, components, motion, voice
- `docs/design-prompt.md` — condensed brand and token reference

## Stack

- Next.js App Router, TypeScript strict
- Tailwind, theme mapped to CSS custom properties in `styles/tokens.css`
- `react-hook-form` + `zod` for forms
- `@tanstack/react-query` for client mutations and polling only
- MSW for API mocking until the backend exists
- `openapi-typescript` generating `lib/api/types.ts` from `openapi.yaml`

Do not add a dependency without asking first. Do not add a global state library.

## Structure

```
app/
  (public)/          landing, apply, signin, verify, invite
  (account)/         settings, programs — account scope, no program in the URL
  (participant)/     home, strands, directory, resources, profile
  (admin)/           dashboard, form builder, roster, runs, reports
  layout.tsx
components/
  ui/                button, input, table, empty-state, dialog
  shell/             headers, sidebar, nav, program switcher, avatar menu
  brand/             weave mark
  icon/              inline svgs
  strand/            strand card, strand panel, match reveal
  form/              dynamic form renderer, field types
lib/
  api/               generated types, typed client, msw handlers
  auth/              session and role guard
  tokens.ts          typed access to CSS variables where JS needs them
styles/
  tokens.css         every design token, single source of truth
docs/
openapi.yaml
```

## Hard rules

**Colour.** No hex, rgb, or hsl anywhere except `styles/tokens.css`. Components use semantic token names only (`--text-primary`, `--action-primary-bg`). If a colour you need does not exist, stop and ask. Do not add one.

**Spacing.** Only 4, 8, 12, 16, 24, 32, 48, 64, 96. No arbitrary Tailwind values like `p-[13px]`.

**Type.** Only the eleven scale tokens from the design direction. Switzer for UI, Gambetta for display, JetBrains Mono for numbers. Gambetta appears in exactly five places, listed in the design doc. Do not use it anywhere else.

**Shadows.** Two only, both defined as tokens. Cards get a border, never a shadow.

**Motion.** Only the five duration tokens and four easing tokens. Animate `transform` and `opacity` only. Never `height`, `top`, `width`, or `box-shadow`.

**Server vs client.** Default to Server Components. Add `"use client"` only when the component needs state, effects, or event handlers. Do not mark a whole page as client to avoid thinking about it.

**Data.** Never call `fetch` directly in a component. All requests go through the typed client in `lib/api`. Types are generated from `openapi.yaml`; do not hand-write response types. If an endpoint you need is missing, add it to `openapi.yaml` first, regenerate, then build.

**Accessibility.** Every interactive element keyboard reachable with a visible focus ring. Never `outline: none` without a replacement. Modals trap focus and return it on close. Every input has a real label; placeholder is never the label. Touch targets 44px minimum. Colour never carries meaning alone.

**States.** Every list has an empty state. Every async action has a loading state. Every fetch has an error state with a retry. A component is not done until all three exist.

**Copy.** Sentence case. Active voice. Name people, not roles. The verb on a button is the verb in the resulting toast. No "Oops", no exclamation marks in system messages, no emoji.

## Do not

- Invent a value that is not in `tokens.css`
- Add gradients, glassmorphism, or shadowed card grids
- Use `any`, or `@ts-ignore`
- Create a component that is not asked for
- Refactor code you were not asked to touch
- Add comments that restate what the code does

## Working style

For anything larger than a single component: write a plan first, list the files you will create or change, and wait for approval before writing code.

One task at a time. Do not build ahead.

When a design doc and my instruction conflict, say so rather than picking one silently.

## Build order

Do not skip ahead.

1. `tokens.css`, Tailwind theme mapping, fonts self-hosted and preloaded
2. `openapi.yaml` for the slice, generated types, MSW handlers
3. Four shells: route groups, layouts, navigation. `(account)` is separate
   because `/settings` and `/programs` carry no org or program in the URL and
   so cannot inherit the participant layout's guard.
4. `ui/` primitives: button, form field, data table, empty state
5. Strand card
6. Dynamic form renderer
7. Slice screens: landing, apply, home, strand detail
8. Admin slice: roster, run review

Match reveal is last. It pays off a product that has to exist first.
