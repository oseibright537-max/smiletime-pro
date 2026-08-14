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

const DEFAULT_WORKSPACE: Organization = {
  id: "default-org",
  name: "FaceTime Workspace",
  slug: "default",
  role: "admin",
};

export function useOrganization() {
  const { user, loading: authLoading } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([DEFAULT_WORKSPACE]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(DEFAULT_WORKSPACE);
  const [loading, setLoading] = useState(false);

  const fetchOrganizations = useCallback(async () => {
    if (!user) {
      setOrganizations([DEFAULT_WORKSPACE]);
      setCurrentOrg(DEFAULT_WORKSPACE);
      return;
    }

    try {
      // Check if organization tables exist on remote database
      const { data: memberRows, error } = await supabase
        .from("organizations")
        .select("id, name, slug, logo_url, settings")
        .limit(10);

      if (!error && memberRows && memberRows.length > 0) {
        const orgs: Organization[] = memberRows.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          logo_url: o.logo_url,
          settings: o.settings,
          role: "admin",
        }));
        setOrganizations(orgs);
        setCurrentOrg(orgs[0] || DEFAULT_WORKSPACE);
      } else {
        // Fallback to default enterprise workspace without throwing error
        setOrganizations([DEFAULT_WORKSPACE]);
        setCurrentOrg(DEFAULT_WORKSPACE);
      }
    } catch {
      setOrganizations([DEFAULT_WORKSPACE]);
      setCurrentOrg(DEFAULT_WORKSPACE);
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
      }
    },
    [organizations],
  );

  return {
    currentOrg,
    currentOrgId: currentOrg?.id || null,
    organizations,
    switchOrganization,
    loading: false,
    refetch: fetchOrganizations,
  };
}
