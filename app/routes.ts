import {
  type RouteConfig,
  index,
  route,
  prefix,
  layout,
} from "@react-router/dev/routes";

export default [
  // API Routes (no locale prefix)
  route("/api/trpc/*", "routes/api/trpc.$.ts"),
  route("/api/auth/*", "routes/api/auth.$.ts"),
  route("/api/upload-file", "routes/api/upload-file.ts"),
  route("/api/set-locale", "routes/api/set-locale.ts"),
  route("/api/room/:code/ws", "routes/api/room.$code.ws.ts"),

  // Public routes at root (default locale)
  index("routes/home.tsx"),
  route("/login", "routes/authentication/login.tsx"),
  route("/sign-up", "routes/authentication/sign-up.tsx"),

  // Public routes with locale prefix (for SEO)
  ...prefix(":lng", [
    index("routes/home.tsx", { id: "lng-home" }),
    route("/login", "routes/authentication/login.tsx", { id: "lng-login" }),
    route("/sign-up", "routes/authentication/sign-up.tsx", { id: "lng-sign-up" }),
  ]),

  // Dashboard routes — auth-protected, client-side i18n only
  ...prefix("dashboard", [
    layout("routes/dashboard/_layout.tsx", [
      route("/", "routes/dashboard/_index.tsx"),
    ]),
  ]),

  // Host room view — auth-protected, client-side i18n only.
  route("/room/:code", "routes/room/$code.tsx"),

  // Guest join view — public loader (no session required to view; the
  // nickname step creates an anonymous session on submit). Host visiting
  // this URL sees the same search/queue tabs (Controls tab is Phase 5).
  route("/join/:code", "routes/join/$code.tsx"),

  // Admin routes — client-side i18n only, no locale prefix
  ...prefix("admin", [
    layout("routes/admin/_layout.tsx", [
      route("/", "routes/admin/_index.tsx"),
      route("/users", "routes/admin/users.tsx"),
      route("/kitchen-sink", "routes/admin/kitchen-sink.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
