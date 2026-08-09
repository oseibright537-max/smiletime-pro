import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge, Button, Field, Input, Panel } from "@/components/ui/primitives";

export const Route = createFileRoute("/console/settings")({
  head: () => ({
    meta: [
      { title: "Settings & Security — FaceTime Attendance" },
      {
        name: "description",
        content: "Manage organization settings, security preferences, and account deletion.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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

  // Reset All Attendance Logs
  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to clear all past attendance clock-in events?")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("attendance_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      toast.success("All attendance records have been cleared.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Wipe All Face Embeddings
  const handleWipeEmbeddings = async () => {
    if (!confirm("Warning: This will delete ALL enrolled face vectors. Employees will need to re-enroll. Continue?")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("face_embeddings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      toast.success("All biometric face vectors have been cleared.");
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
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-display">
          Workspace Settings & Security
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage administrator security, biometric policies, data retention, and account lifecycle.
        </p>
      </div>

      {/* Account Profile Card */}
      <Panel className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 font-display">Administrator Profile</h2>
            <span className="text-xs text-slate-500">Signed in credentials & permissions</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-slate-500 font-medium block">Email Address</span>
            <span className="font-semibold text-slate-900 text-sm block">{user?.email ?? "Not logged in"}</span>
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
          <div className="flex gap-3">
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
      <Panel className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 font-display">Data Management & Maintenance</h2>
            <span className="text-xs text-slate-500">Purge past telemetry or reset workforce face templates</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Clear Attendance Log History</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Deletes all past clock-in and clock-out logs. Employee directory remains intact.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearLogs}
              loading={busy}
              icon={<RotateCcw className="h-3.5 w-3.5 text-slate-600" />}
            >
              Clear Attendance Logs
            </Button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Wipe All Face Vectors</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Deletes all mathematical facial templates. All staff will need to re-enroll.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleWipeEmbeddings}
              loading={busy}
              icon={<Trash2 className="h-3.5 w-3.5 text-amber-600" />}
            >
              Wipe Face Embeddings
            </Button>
          </div>
        </div>
      </Panel>

      {/* Danger Zone: Account Deletion */}
      <Panel className="bg-rose-50/50 border border-rose-200 shadow-sm rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-rose-200">
          <div className="h-10 w-10 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-rose-900 font-display">Danger Zone</h2>
            <span className="text-xs text-rose-700">Permanent and irreversible workspace actions</span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Delete Administrator Account</h3>
            <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
              Once you delete your account, your administrator session, security profile, and roles
              will be permanently removed. You will be logged out immediately.
            </p>
          </div>

          {!showDeleteModal ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
              icon={<Trash2 className="h-4 w-4" />}
            >
              Delete My Account
            </Button>
          ) : (
            <div className="p-4 rounded-xl bg-white border border-rose-300 space-y-3 max-w-md animate-in fade-in zoom-in-95 duration-150">
              <span className="text-xs text-slate-700 font-medium block">
                Type <span className="font-mono font-bold text-rose-600">DELETE MY ACCOUNT</span> below to confirm:
              </span>
              <Input
                value={confirmDeleteText}
                onChange={(e) => setConfirmDeleteText(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                className="text-xs border-rose-300"
              />
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={confirmDeleteText !== "DELETE MY ACCOUNT"}
                  loading={busy}
                >
                  Permanently Delete
                </Button>
                <Button
                  variant="ghost"
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
        </div>
      </Panel>
    </div>
  );
}
