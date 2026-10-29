import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SetupMessForm from "@/app/setup/setup-mess-form";
import { getUserGroupContext } from "@/lib/group-access";
import ThemeToggle from "@/components/theme/theme-toggle";

export default async function SetupPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { group } = await getUserGroupContext(supabase, user.id);

  if (group) {
    redirect("/");
  }

  return (
    <main className="relative min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="absolute right-4 top-4 sm:right-8 sm:top-8">
        <ThemeToggle />
      </div>

      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Setup Your Mess</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Create your mess first. You will become the admin automatically and can add members later.
          </p>
        </div>

        <SetupMessForm userId={user.id} />
      </div>
    </main>
  );
}