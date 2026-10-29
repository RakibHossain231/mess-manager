import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component where cookies cannot be set.
          }
        },
      },
    }
  );
}

/**
 * Fast user lookup for Server Components.
 * Reads the verified user ID from the request headers set by middleware in 0ms,
 * avoiding a redundant remote HTTP roundtrip to Supabase Auth on every single page load.
 */
export async function getAuthUser(supabaseClient?: any): Promise<{
  id: string;
  email: string | null;
} | null> {
  try {
    const headerStore = await headers();
    const userId = headerStore.get("x-user-id");
    const userEmail = headerStore.get("x-user-email");

    if (userId) {
      return { id: userId, email: userEmail || null };
    }
  } catch {
    // If headers() is unavailable
  }

  // Safe fallback to remote call if header was not present
  const client = supabaseClient ?? (await createClient());
  const { data } = await client.auth.getUser();

  if (data?.user) {
    return {
      id: data.user.id,
      email: data.user.email ?? null,
    };
  }

  return null;
}
