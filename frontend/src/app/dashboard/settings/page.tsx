"use client";

import { useSession } from "next-auth/react";
import { User, Building2 } from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your workspace and account settings.
        </p>
      </div>

      {/* Workspace settings */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-6">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Workspace</h2>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium">Workspace Name</label>
            <input
              type="text"
              defaultValue="My Workspace"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:border-ring focus:ring-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Slug</label>
            <input
              type="text"
              defaultValue="my-workspace"
              disabled
              className="mt-1 w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Workspace slug cannot be changed.
            </p>
          </div>
        </div>
      </div>

      {/* Account settings */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-6">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Account</h2>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              defaultValue={session?.user?.email || ""}
              disabled
              className="mt-1 w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Email is managed by your OAuth provider.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium">Display Name</label>
            <input
              type="text"
              defaultValue={session?.user?.name || ""}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:border-ring focus:ring-2"
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          Save Changes
        </button>
      </div>
    </div>
  );
}
