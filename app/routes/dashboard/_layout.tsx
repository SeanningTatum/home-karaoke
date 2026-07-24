import { Outlet } from "react-router";
import { requireSession } from "@/lib/session";
import type { Route } from "./+types/_layout";

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = await requireSession(request, context);
  return { user: session.user };
}

export default function DashboardLayout({ loaderData }: Route.ComponentProps) {
  return (
    <div className="bg-stagelight-dim min-h-screen">
      <Outlet context={loaderData} />
    </div>
  );
}
