import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ShieldAlert,
  Trash2,
  Lock,
  User,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Settings,
  Mail,
  Building,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Badge, Button, Field, Input, Panel } from "@/components/ui/primitives";

export const Route = createFileRoute("/console/settings")({
  head: () => ({
    meta: [
      { title: "Company Settings & Security — FaceTime Attendance" },
      {
        name: "description",
        content: "Manage company settings, multi-tenant preferences, and security lifecycle.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, roles, signOut } = useAuth();
  const { currentOrg, currentOrgId, refetch: refetchOrg } = useOrganization();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [companyName, setCompanyName] = useState(currentOrg?.name || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (currentOrg?.name) {
      setCompanyName(currentOrg.name);
    }
  }, [currentOrg]);

  // Update Company Name
  const handleUpdateCompanyName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrgId) return;
    const trimmed = companyName.trim();
    if (trimmed.length < 2) {
      toast.error("Company name must be at least 2 characters.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ name: trimmed })
        .eq("id", currentOrgId);

      if (error) throw error;
      toast.success("Company name updated successfully!");
      void refetchOrg();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Update Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully");
      setNewPassword("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Reset All Attendance Logs for active company
  const handleClearLogs = async () => {
    if (
      !confirm(
        `Are you sure you want to clear all past attendance clock-in events for ${currentOrg?.name || "this company"}?`,
      )
    )
      return;
    setBusy(true);
    try {
      let query = supabase
        .from("attendance_events")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (currentOrgId) {
        query = query.eq("organization_id", currentOrgId);
      }
      const { error } = await query;
      if (error) throw error;
      toast.success("Attendance records for this company have been cleared.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Wipe All Face Embeddings for active company
  const handleWipeEmbeddings = async () => {
    if (
      !confirm(
        `Warning: This will delete ALL enrolled face vectors for ${currentOrg?.name || "this company"}. Employees will need to re-enroll. Continue?`,
      )
    )
      return;
    setBusy(true);
    try {
      let query = supabase
        .from("face_embeddings")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (currentOrgId) {
        query = query.eq("organization_id", currentOrgId);
      }
      const { error } = await query;
      if (error) throw error;
      toast.success("All biometric face vectors for this company have been cleared.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Delete User Account
  const handleDeleteAccount = async () => {
    if (confirmDeleteText !== "DELETE MY ACCOUNT") {
      toast.error("Please type DELETE MY ACCOUNT to confirm.");
      return;
    }
    setBusy(true);
    try {
      if (user?.id) {
        await supabase.from("profiles").delete().eq("id", user.id);
        await supabase.from("user_roles").delete().eq("user_id", user.id);
      }
      await signOut();
      toast.success("Your account profile has been deleted.");
      navigate({ to: "/auth", search: { next: undefined } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-4xl">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-display">
          Company Settings & Security
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Manage company workspace details, biometric policies, shift windows, and security
          lifecycle.
        </p>
      </div>

      {/* Company / Tenant Profile Card */}
      {currentOrg && (
        <Panel className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-display">Company Workspace</h2>
              <span className="text-xs text-slate-500">
                Multi-tenant enterprise account details
              </span>
            </div>
          </div>

          <form onSubmit={handleUpdateCompanyName} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 font-display">
                  Company / Organization Name
                </label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Corporation"
                  required
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 font-medium block">Tenant ID (UUID)</span>
                <span className="font-mono text-slate-700 text-xs block truncate select-all">
                  {currentOrg.id}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                size="sm"
                loading={busy}
                icon={<Save className="h-3.5 w-3.5" />}
              >
                Save Company Name
              </Button>
            </div>
          </form>
        </Panel>
      )}

      {/* Administrator Profile Card */}
      <Panel className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 font-display">
              Administrator Profile
            </h2>
            <span className="text-xs text-slate-500">Signed in credentials & permissions</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-slate-500 font-medium block">Email Address</span>
            <span className="font-semibold text-slate-900 text-sm block">
              {user?.email ?? "Not logged in"}
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-slate-500 font-medium block">Assigned Roles</span>
            <div className="flex gap-1.5 pt-0.5">
              {roles.map((r) => (
                <Badge key={r} tone="primary" size="sm">
                  {r.toUpperCase()}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Change Password Form */}
        <form onSubmit={handleUpdatePassword} className="space-y-4 pt-2">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-indigo-600" />
            Update Password
          </h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              type="password"
              placeholder="Enter new password (min 6 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="max-w-md"
              required
            />
            <Button type="submit" loading={busy} size="sm">
              Save New Password
            </Button>
          </div>
        </form>
      </Panel>

      {/* Biometric & System Retention Card */}
      <Panel className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 font-display">
              Data Management & Maintenance
            </h2>
            <span className="text-xs text-slate-500">
              Purge telemetry or reset biometric face templates for{" "}
              {currentOrg?.name || "this company"}
            </span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Clear Attendance Logs</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Deletes all past clock-in and clock-out logs for this company. Employee directory
                remains intact.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearLogs}
              loading={busy}
              icon={<RotateCcw className="h-3.5 w-3.5 text-amber-600" />}
              className="w-full justify-center"
            >
              Clear Company Logs
            </Button>
          </div>

          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Reset Face Templates</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Wipes all enrolled neural vector embeddings for this company. Employees will need to
                re-enroll.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleWipeEmbeddings}
              loading={busy}
              icon={<Trash2 className="h-3.5 w-3.5 text-rose-600" />}
              className="w-full justify-center text-rose-700 hover:bg-rose-100"
            >
              Wipe Biometric Vectors
            </Button>
          </div>
        </div>
      </Panel>

      {/* Danger Zone: Account Deletion */}
      <Panel className="border border-rose-200 bg-rose-50/30 shadow-sm rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-rose-950 font-display">Danger Zone</h2>
            <span className="text-xs text-rose-700">Irreversible account deletion actions</span>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Deleting your administrator account will remove your login credentials, role assignments,
          and unlink your profile.
        </p>

        {!showDeleteModal ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
            className="text-rose-700 hover:bg-rose-100"
          >
            Delete Administrator Account
          </Button>
        ) : (
          <div className="space-y-3 p-4 rounded-xl bg-white border border-rose-300">
            <p className="text-xs font-semibold text-rose-900">
              Type <span className="font-mono font-bold">DELETE MY ACCOUNT</span> below to
              permanently confirm:
            </p>
            <Input
              value={confirmDeleteText}
              onChange={(e) => setConfirmDeleteText(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              className="border-rose-300 focus:border-rose-600 text-xs"
            />
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleDeleteAccount}
                loading={busy}
                disabled={confirmDeleteText !== "DELETE MY ACCOUNT"}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Permanently Delete Account
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmDeleteText("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
