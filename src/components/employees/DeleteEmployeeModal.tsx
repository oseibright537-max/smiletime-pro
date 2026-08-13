import React from "react";
import { Trash2, AlertTriangle, X, ShieldAlert } from "lucide-react";
import { Button, Panel, Badge } from "@/components/ui/primitives";

interface DeleteEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  employee: {
    id: string;
    full_name: string;
    employee_code: string;
    job_title?: string | null;
    department_name?: string | null;
    templatesCount?: number;
  } | null;
}

export function DeleteEmployeeModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  employee,
}: DeleteEmployeeModalProps) {
  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl border border-rose-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rose-100 bg-rose-50/70">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-rose-950 font-display">
                Delete Employee Profile
              </h2>
              <span className="text-xs text-rose-700">Permanent and irreversible action</span>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-rose-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to permanently delete this employee? All associated biometric face
            vector embeddings and attendance event records will be permanently removed.
          </p>

          {/* Employee Card Preview */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">{employee.full_name}</span>
              <span className="font-mono text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {employee.employee_code}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-slate-500 text-[11px]">
              <div>
                <span className="block font-medium text-slate-400">Department</span>
                <span className="text-slate-700 font-semibold">
                  {employee.department_name || "Unassigned"}
                </span>
              </div>
              <div>
                <span className="block font-medium text-slate-400">Job Title</span>
                <span className="text-slate-700 font-semibold">
                  {employee.job_title || "Staff"}
                </span>
              </div>
            </div>

            {employee.templatesCount !== undefined && employee.templatesCount > 0 && (
              <div className="pt-2 border-t border-slate-200 flex items-center gap-1.5 text-rose-700 font-medium text-[11px]">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>{employee.templatesCount} facial biometric vectors will be wiped.</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onConfirm}
            loading={loading}
            icon={<Trash2 className="h-4 w-4" />}
          >
            Permanently Delete Employee
          </Button>
        </div>
      </div>
    </div>
  );
}
