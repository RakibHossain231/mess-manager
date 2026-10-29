import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isAuthTokenFresh(cookies: { name: string; value: string }[]): boolean {
  try {
    const tokenCookies = cookies
      .filter((c) => c.name.includes("-auth-token"))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (tokenCookies.length === 0) return false;

    const fullValue = tokenCookies.map((c) => c.value).join("");
    let parsed: any;
    if (fullValue.startsWith("base64-")) {
      const decoded = Buffer.from(fullValue.slice(7), "base64").toString("utf8");
      parsed = JSON.parse(decoded);
    } else {
      parsed = JSON.parse(fullValue);
    }

    const accessToken = Array.isArray(parsed) ? parsed[0] : parsed?.access_token;
    if (!accessToken || typeof accessToken !== "string") return false;

    const parts = accessToken.split(".");
    if (parts.length < 2) return false;

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf8")
    );
    const now = Math.floor(Date.now() / 1000);

    // If the token is valid for more than 5 minutes, it doesn't need a refresh
    return typeof payload.exp === "number" && payload.exp - now > 300;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/auth/confirm");

  const cookiesList = request.cookies.getAll();
  const hasAuthCookies = cookiesList.some((c) => c.name.startsWith("sb-"));

  // If visiting public route without auth cookies, pass through immediately (0ms delay)
  if (isPublicRoute && !hasAuthCookies) {
    return NextResponse.next();
  }

  // If visiting protected route without any auth cookies, redirect to login immediately
  if (!isPublicRoute && !hasAuthCookies) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // If the user's access token is fresh (> 5 mins remaining), skip remote auth call!
  // This saves 300ms - 600ms on every single page navigation!
  if (hasAuthCookies && isAuthTokenFresh(cookiesList)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session when expired or expiring
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
