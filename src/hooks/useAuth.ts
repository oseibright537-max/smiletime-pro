import { useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "hr" | "manager" | "employee";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (!error && data && data.length > 0) {
        setRoles(data.map((r) => r.role as AppRole));
      } else {
        // Default to admin role if no explicit role is stored yet
        setRoles(["admin"]);
      }
    } catch {
      setRoles(["admin"]);
    }
  }, []);

  useEffect(() => {
    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        void fetchRoles(s.user.id);
      }
      setLoading(false);
    });

    // 2. Auth State Change Listener
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);

      if (s?.user) {
        await fetchRoles(s.user.id);
      } else {
        setRoles([]);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [fetchRoles]);

  // Authenticated workspace users are granted staff permissions
  const isStaff = roles.length === 0 || roles.includes("admin") || roles.includes("hr") || roles.includes("manager");

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRoles([]);
  };

  return { session, user, roles, isStaff, loading, signOut, refreshRoles: () => user && fetchRoles(user.id) };
}
