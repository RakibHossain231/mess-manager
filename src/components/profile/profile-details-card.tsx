"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProfileDetailsCardProps = {
  memberId: string;
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

type EditableItemProps = {
  label: string;
  value: string;
  name: string;
  disabled: boolean;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  type?: string;
  placeholder?: string;
  textarea?: boolean;
};

function EditableItem({
  label,
  value,
  name,
  disabled,
  onChange,
  type = "text",
  placeholder,
  textarea = false,
}: EditableItemProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      {textarea ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          rows={2}
          placeholder={placeholder}
          className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-600 disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:px-0 disabled:py-0"
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-600 disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:px-0"
        />
      )}
    </div>
  );
}

export default function ProfileDetailsCard({
  memberId,
  name,
  role,
  email,
  mobileNumber,
  nidNumber,
  groupName,
  monthlyRent,
  monthLabel,
}: ProfileDetailsCardProps) {
  const supabase = createClient();

  const initial = name?.trim()?.charAt(0)?.toUpperCase() || "U";

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [formData, setFormData] = useState({
    name: name || "Empty",
    email: email || "",
    mobileNumber: mobileNumber || "",
    nidNumber: nidNumber || "Empty",
  });

  const currentOpenMonthText = useMemo(() => {
    if (monthLabel && monthLabel.trim()) return monthLabel;

    const currentDate = new Date();
    return currentDate.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [monthLabel]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleEditToggle() {
    setMessage("");
    setIsEditing(true);
  }

  function handleCancel() {
    setFormData({
      name: name || "",
      email: email || "",
      mobileNumber: mobileNumber || "",
      nidNumber: nidNumber || "",
    });
    setMessage("");
    setIsEditing(false);
  }

  async function handleSave() {
    setMessage("");

    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedMobile = formData.mobileNumber.trim();
    const trimmedNid = formData.nidNumber.trim();

    if (!trimmedName) {
      setMessage("Name is required.");
      return;
    }

    if (!trimmedEmail) {
      setMessage("Email is required.");
      return;
    }
     if (!trimmedMobile) {
      setMessage("Mobile Number is required.");
      return;
    }

    setSaving(true);

    const { error: memberError } = await supabase
      .from("members")
      .update({
        name: trimmedName,
        mobile_number: trimmedMobile || null,
        nid_number: trimmedNid || null,
      })
      .eq("id", memberId);

    if (memberError) {
      setSaving(false);
      setMessage(memberError.message);
      return;
    }

    let finalMessage = "Profile updated successfully.";

    if (trimmedEmail !== (email || "")) {
      const { error: authError } = await supabase.auth.updateUser({
        email: trimmedEmail,
        data: {
          name: trimmedName,
          full_name: trimmedName,
          display_name: trimmedName,
        },
      });

      if (authError) {
        setSaving(false);
        setMessage(authError.message);
        return;
      }

      finalMessage =
        "Profile updated. If email confirmation is enabled, please verify your new email address.";
    } else {
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          name: trimmedName,
          full_name: trimmedName,
          display_name: trimmedName,
        },
      });

      if (metadataError) {
        setSaving(false);
        setMessage(metadataError.message);
        return;
      }
    }

    setSaving(false);
    setIsEditing(false);
    setMessage(finalMessage);
    window.location.reload();
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xl font-bold text-white shadow-sm">
            {(formData.name?.trim()?.charAt(0) || initial).toUpperCase()}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">
                {formData.name || "User"}
              </h2>
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Current Open Month
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {currentOpenMonthText || "No open month"}
            </p>
          </div>

          {!isEditing ? (
            <button
              type="button"
              onClick={handleEditToggle}
              className="rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              Edit Profile
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {message ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <EditableItem
          label="Full Name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          disabled={!isEditing}
          placeholder="Enter your full name"
        />

        <InfoItem label="Role" value={formatRole(role)} />

        <EditableItem
          label="Email / Login ID"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          disabled={!isEditing}
          placeholder="Enter your email"
        />

        <EditableItem
          label="Mobile Number"
          name="mobileNumber"
          value={formData.mobileNumber}
          onChange={handleChange}
          disabled={!isEditing}
          placeholder="Enter your mobile number"
        />

        <EditableItem
          label="NID Number"
          name="nidNumber"
          value={formData.nidNumber}
          onChange={handleChange}
          disabled={!isEditing}
          placeholder="Enter your NID number"
        />

        <InfoItem label="Mess / Group" value={groupName || "Not available"} />

        <InfoItem
          label="Monthly Rent"
          value={
            typeof monthlyRent === "number"
              ? `৳ ${monthlyRent.toFixed(0)}`
              : "Not set"
          }
        />

        <InfoItem label="Account Status" value="Active" />
      </div>
    </section>
  );
}