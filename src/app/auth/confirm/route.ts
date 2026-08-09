import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Server-side entry for email auth links (password recovery, etc).
// Supabase redirects the verify endpoint here with either a PKCE `code`
// or a `token_hash` + `type`. We establish the session (setting cookies)
// and then forward the user to the real page (default: /reset-password).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Only allow internal redirect targets (no open redirect).
  const nextParam = searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/reset-password";

  const supabase = await createClient();

  let message = "Invalid or expired reset link.";

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(next);
    }
    message = error.message;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      redirect(next);
    }
    message = error.message;
  }

  redirect(`/reset-password?error=${encodeURIComponent(message)}`);
}
