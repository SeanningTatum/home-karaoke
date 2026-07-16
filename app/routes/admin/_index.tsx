import { redirect } from "react-router";
import type { Route } from "./+types/_index";

/**
 * The old analytics demo dashboard lived here (Phase 2 UI overhaul cut it —
 * see .brain/features/ui-overhaul/ui-overhaul.md). `/admin/` now redirects
 * straight to user management, the one admin surface this app actually
 * needs day-to-day.
 */
export async function loader(_: Route.LoaderArgs) {
  throw redirect("/admin/users");
}

export default function AdminHome() {
  return null;
}
