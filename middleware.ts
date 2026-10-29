import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function extractUserFromToken(cookies: { name: string; value: string }[]) {
  try {
    const tokenCookies = cookies
      .filter((c) => c.name.includes("-auth-token"))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (tokenCookies.length === 0) return null;

    const fullValue = tokenCookies.map((c) => c.value).join("");
    let parsed: any;
    if (fullValue.startsWith("base64-")) {
      const decoded = Buffer.from(fullValue.slice(7), "base64").toString("utf8");
      parsed = JSON.parse(decoded);
    } else {
      parsed = JSON.parse(fullValue);
    }

    const accessToken = Array.isArray(parsed) ? parsed[0] : parsed?.access_token;
    if (!accessToken || typeof accessToken !== "string") return null;

    const parts = accessToken.split(".");
    if (parts.length < 2) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf8")
    );
    const now = Math.floor(Date.now() / 1000);
    const isFresh = typeof payload.exp === "number" && payload.exp - now > 60;

    return {
      id: payload.sub as string,
      email: (payload.email as string) || null,
      isFresh,
    };
  } catch {
    return null;
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

  const tokenInfo = extractUserFromToken(cookiesList);

  // If the user's access token is valid (> 1 min remaining), pass through with x-user-id header!
  // This completely eliminates the 300ms - 500ms remote auth call on every single navigation!
  if (tokenInfo && tokenInfo.isFresh) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", tokenInfo.id);
    if (tokenInfo.email) requestHeaders.set("x-user-email", tokenInfo.email);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const requestHeaders = new Headers(request.headers);
  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
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
  const { data } = await supabase.auth.getUser();
  if (data?.user) {
    requestHeaders.set("x-user-id", data.user.id);
    if (data.user.email) requestHeaders.set("x-user-email", data.user.email);
  } else if (!isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
