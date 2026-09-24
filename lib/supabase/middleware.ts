import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Paths under /admin that should remain accessible without a session.
// Everything else under /admin requires authentication.
const PUBLIC_ADMIN_PATHS = [
  "/admin/login",
  "/admin/signup",
  "/admin/setup",
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options?: any }>
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() verifies the JWT with the Supabase auth server.
  // Do not replace this with getSession() — getSession() reads cookies
  // without validating them and must not be trusted for access control.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Debug logging in development
  if (
    process.env.NODE_ENV === "development" &&
    request.nextUrl.pathname.startsWith("/admin")
  ) {
    const allCookies = request.cookies.getAll();
    const supabaseCookies = allCookies.filter((c) => c.name.startsWith("sb-"));

    console.log("[Middleware Debug]", {
      path: request.nextUrl.pathname,
      hasUser: !!user,
      userId: user?.id,
      userError: userError?.message,
      cookieCount: supabaseCookies.length,
      cookieNames: supabaseCookies.map((c) => c.name),
    });
  }

  const pathname = request.nextUrl.pathname;

  // Protect /admin/* except the explicitly public paths.
  const isAdminPath = pathname.startsWith("/admin");
  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isAdminPath && !isPublicAdminPath && !user) {
    const redirectUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Don't redirect authenticated users away from login/signup/setup here.
  // Let the page components decide what to do — this avoids redirect loops.

  return supabaseResponse;
}