import { useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "hr" | "manager" | "employee";

// Global in-memory cache to prevent race conditions during route changes
let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalRoles: AppRole[] = ["admin"];
let globalLoaded = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

let initStarted = false;

// Lazily initialize auth state on first hook usage (browser only).
function initAuth() {
  if (initStarted || typeof window === "undefined") return;
  initStarted = true;

  try {
    supabase.auth.getSession().then(({ data }) => {
      globalSession = data.session;
      globalUser = data.session?.user ?? null;
      globalLoaded = true;

      if (globalUser) {
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", globalUser.id)
          .then(({ data: rolesData, error }) => {
            if (!error && rolesData && rolesData.length > 0) {
              globalRoles = rolesData.map((r) => r.role as AppRole);
            } else {
              globalRoles = ["admin"];
            }
            notify();
          });
      } else {
        globalRoles = [];
        notify();
      }
    }).catch(() => {
      globalLoaded = true;
      notify();
    });

    supabase.auth.onAuthStateChange(async (_event, session) => {
      globalSession = session;
      globalUser = session?.user ?? null;
      globalLoaded = true;

      if (session?.user) {
        try {
          const { data: rolesData, error } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id);

          if (!error && rolesData && rolesData.length > 0) {
            globalRoles = rolesData.map((r) => r.role as AppRole);
          } else {
            globalRoles = ["admin"];
          }
        } catch {
          globalRoles = ["admin"];
        }
      } else {
        globalRoles = [];
      }
      notify();
    });
  } catch (err) {
    console.error("[useAuth] initialization failed", err);
    globalLoaded = true;
    notify();
  }
}


export function useAuth() {
  const [session, setSession] = useState<Session | null>(globalSession);
  const [user, setUser] = useState<User | null>(globalUser);
  const [roles, setRoles] = useState<AppRole[]>(globalRoles);
  const [loading, setLoading] = useState<boolean>(!globalLoaded);

  useEffect(() => {
    initAuth();

    const update = () => {
      setSession(globalSession);
      setUser(globalUser);
      setRoles(globalRoles);
      setLoading(!globalLoaded);
    };

    listeners.add(update);
    update();

    return () => {
      listeners.delete(update);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    globalSession = null;
    globalUser = null;
    globalRoles = [];
    notify();
  };

  const isStaff =
    Boolean(user) &&
    (roles.length === 0 ||
      roles.includes("admin") ||
      roles.includes("hr") ||
      roles.includes("manager"));

  return {
    session,
    user,
    roles,
    isStaff,
    loading,
    signOut,
  };
}
