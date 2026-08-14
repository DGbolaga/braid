import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/guard";

/**
 * The root is a signpost, not a page.
 *
 * Braid has no single landing page because a landing page belongs to a
 * programme rather than to the product — She Code Africa's cohort and UniLag's
 * writing programme each have their own at `/p/:org/:program`, and that is the
 * link a coordinator actually sends out. Architecture 2 starts its sitemap
 * there for that reason.
 *
 * What it must not be is a 404. Somebody who types the bare domain has either
 * been here before or is about to sign in, so this sends them to whichever is
 * true rather than to nothing.
 */
export default async function RootPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const { participations } = session;

  // Somebody in one programme goes straight into it — the intermediate list
  // would be a screen with a single row and one thing to click.
  if (participations.length === 1) {
    const only = participations[0];
    redirect(
      only.isCoordinator
        ? `/admin/o/${only.orgSlug}`
        : `/o/${only.orgSlug}/p/${only.programSlug}`,
    );
  }

  // More than one, or none at all: the programmes list is right in both cases.
  // With none it is an empty state that explains how somebody joins, which is
  // more use than dropping them at a sign-in form they have already passed.
  redirect("/programs");
}
