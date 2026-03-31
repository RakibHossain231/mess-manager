type ProfileDetailsCardProps = {
  name: string;
  role: string;
  email?: string | null;
  mobileNumber?: string | null;
  nidNumber?: string | null;
  groupName: string;
  monthlyRent?: number | null;
  monthLabel?: string | null;
};

function formatRole(role: string) {
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  return "Member";
}

function getRoleBadgeClasses(role: string) {
  if (role === "admin") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }

  if (role === "manager") {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }

  return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
}

type InfoItemProps = {
  label: string;
  value: string;
};

function InfoItem({ label, value }: InfoItemProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-all text-sm font-medium text-slate-900">
        {value}
      </p>
    </div>
  );
}

export default function ProfileDetailsCard({
  name,
  role,
  email,
  mobileNumber,
  nidNumber,
  groupName,
  monthlyRent,
  monthLabel,
}: ProfileDetailsCardProps) {
  const initial = name?.trim()?.charAt(0)?.toUpperCase() || "U";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xl font-bold text-white shadow-sm">
            {initial}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{name}</h2>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getRoleBadgeClasses(
                  role
                )}`}
              >
                {formatRole(role)}
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Logged in account and mess information
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current Open Month
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {monthLabel || "No open month"}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <InfoItem label="Full Name" value={name || "Not available"} />
        <InfoItem label="Role" value={formatRole(role)} />
        <InfoItem label="Email / Login ID" value={email || "Not available"} />
        <InfoItem
          label="Mobile Number"
          value={mobileNumber || "Not added"}
        />
        <InfoItem label="NID Number" value={nidNumber || "Not added"} />
        <InfoItem label="Mess / Group" value={groupName || "Not available"} />
        <InfoItem
          label="Monthly Rent"
          value={
            typeof monthlyRent === "number"
              ? `৳ ${monthlyRent.toFixed(0)}`
              : "Not set"
          }
        />
        <InfoItem
          label="Account Status"
          value="Active"
        />
        <InfoItem
          label="Current Open Month"
          value={monthLabel || "No open month"}
        />
      </div>
    </section>
  );
}