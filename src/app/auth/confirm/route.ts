import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Server-side entry for email auth links (signup confirmation, email change, password recovery, etc).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const isEmailChange = type === "email_change";
  const isSignupOrEmail = type === "signup" || type === "email" || isEmailChange;
  const defaultNext = isEmailChange
    ? "/profile?email_changed=true"
    : isSignupOrEmail
    ? "/login?verified=true"
    : "/reset-password";

  // Only allow internal redirect targets (no open redirect).
  const nextParam = searchParams.get("next");
  const nextPath =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : defaultNext;

  const supabase = await createClient();

  // If a valid session already exists (e.g. email change while logged in)
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (currentUser) {
    if (currentUser.email) {
      try {
        const metadata = currentUser.user_metadata || {};
        const fullName =
          metadata.full_name || metadata.name || currentUser.email.split("@")[0] || "User";
        const phone = metadata.phone || null;

        await supabase.from("profiles").upsert({
          id: currentUser.id,
          full_name: fullName,
          email: currentUser.email,
          phone: phone,
        });

        await supabase
          .from("members")
          .update({ email: currentUser.email })
          .eq("user_id", currentUser.id);
      } catch (err) {
        console.error("Profile sync error:", err);
      }
    }
    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  let message = "Invalid or expired verification link.";
  let success = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      success = true;
    } else {
      message = error.message;
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      success = true;
    } else {
      message = error.message;
    }
  } else {
    // If neither code nor tokenHash was in searchParams, it may be a client hash (#access_token=...)
    // Serve an HTML client bridge that forwards hash fragments directly to the target page:
    return new NextResponse(
      `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Verifying...</title></head>
  <body>
    <script>
      const hash = window.location.hash || '';
      const params = new URLSearchParams(window.location.search);
      const next = params.get('next') || '${defaultNext}';
      window.location.replace(next + hash);
    </script>
  </body>
</html>`,
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  if (success) {
    // Sync profile and members table with the verified email
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && user.email) {
        const metadata = user.user_metadata || {};
        const fullName =
          metadata.full_name || metadata.name || user.email.split("@")[0] || "User";
        const phone = metadata.phone || null;

        await supabase.from("profiles").upsert({
          id: user.id,
          full_name: fullName,
          email: user.email,
          phone: phone,
        });

        await supabase
          .from("members")
          .update({ email: user.email })
          .eq("user_id", user.id);
      }
    } catch (profileErr) {
      console.error("Failed to sync profile after email confirm:", profileErr);
    }

    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  const errorTarget = isEmailChange
    ? "/profile"
    : isSignupOrEmail
    ? "/login"
    : "/reset-password";

  return NextResponse.redirect(
    new URL(`${errorTarget}?error=${encodeURIComponent(message)}`, request.url)
  );
}
