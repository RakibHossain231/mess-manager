import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SetupMessForm from "@/app/setup/setup-mess-form";
import { getUserGroupContext } from "@/lib/group-access";

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
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Setup Your Mess</h1>
          <p className="mt-2 text-slate-600">
            Create your mess first. You will become the admin automatically and can add members later.
          </p>
        </div>

        <SetupMessForm userId={user.id} />
      </div>
    </main>
  );
}