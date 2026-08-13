import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Organization = {
  id: string;
  name: string;
  slug?: string | null;
  logo_url?: string | null;
  role?: string;
  settings?: {
    morning_cutoff?: string;
    evening_window_start?: string;
    evening_window_end?: string;
    match_threshold?: number;
  } | null;
};

const STORAGE_KEY = "facetime_active_organization_id";

export function useOrganization() {
  const { user, loading: authLoading } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrganizations = useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrg(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Fetch organizations via membership join
      const { data: memberRows, error: memberError } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations(id, name, slug, logo_url, settings)")
        .eq("user_id", user.id);

      if (!memberError && memberRows && memberRows.length > 0) {
        const orgs: Organization[] = memberRows
          .filter((m) => m.organizations)
          .map((m) => {
            const o = m.organizations as unknown as Organization;
            return {
              id: o.id,
              name: o.name,
              slug: o.slug,
              logo_url: o.logo_url,
              settings: o.settings,
              role: m.role,
            };
          });

        setOrganizations(orgs);

        // Select previously stored organization or default to first
        const savedOrgId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        const matched = orgs.find((o) => o.id === savedOrgId) || orgs[0];
        setCurrentOrg(matched || null);
        if (matched && typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, matched.id);
        }
      } else {
        // Fallback: Check if user created an organization directly or query organizations table
        const { data: directOrgs } = await supabase
          .from("organizations")
          .select("id, name, slug, logo_url, settings")
          .order("created_at", { ascending: true })
          .limit(1);

        if (directOrgs && directOrgs.length > 0) {
          const first = directOrgs[0] as unknown as Organization;
          setOrganizations([first]);
          setCurrentOrg(first);
        } else {
          setOrganizations([]);
          setCurrentOrg(null);
        }
      }
    } catch (err) {
      console.warn("Could not load organization data:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      void fetchOrganizations();
    }
  }, [authLoading, fetchOrganizations]);

  const switchOrganization = useCallback(
    (orgId: string) => {
      const selected = organizations.find((o) => o.id === orgId);
      if (selected) {
        setCurrentOrg(selected);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, selected.id);
        }
      }
    },
    [organizations],
  );

  return {
    currentOrg,
    currentOrgId: currentOrg?.id || null,
    organizations,
    switchOrganization,
    loading: loading || authLoading,
    refetch: fetchOrganizations,
  };
}
