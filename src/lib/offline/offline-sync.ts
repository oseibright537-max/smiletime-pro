import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface QueuedAttendanceEvent {
  id: string;
  organization_id?: string | null;
  employee_id: string;
  employee_name: string;
  employee_code?: string;
  kind: "check_in" | "check_out" | "break_start" | "break_end";
  status: string;
  local_date: string;
  occurred_at: string;
  confidence: number;
  liveness_score: number;
  device_label: string;
  synced: boolean;
}

const OFFLINE_QUEUE_KEY = "facetime_offline_attendance_queue_v1";

export function getOfflineQueue(): QueuedAttendanceEvent[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: QueuedAttendanceEvent[]): void {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("Failed to persist offline attendance queue:", err);
  }
}

export function enqueueOfflinePunch(
  event: Omit<QueuedAttendanceEvent, "id" | "occurred_at" | "synced">,
): QueuedAttendanceEvent {
  const queue = getOfflineQueue();
  const newEvent: QueuedAttendanceEvent = {
    ...event,
    id: "offline_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    occurred_at: new Date().toISOString(),
    synced: false,
  };

  queue.push(newEvent);
  saveOfflineQueue(queue);
  return newEvent;
}

export async function flushOfflineQueue(
  onProgress?: (syncedCount: number, total: number) => void,
): Promise<{ success: number; failed: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { success: 0, failed: 0 };

  const unsynced = queue.filter((item) => !item.synced);
  if (unsynced.length === 0) return { success: 0, failed: 0 };

  let successCount = 0;
  let failCount = 0;
  const remainingQueue: QueuedAttendanceEvent[] = [];

  for (const item of unsynced) {
    try {
      const { error } = await supabase.from("attendance_events").insert({
        employee_id: item.employee_id,
        kind: item.kind,
        status: item.status,
        local_date: item.local_date,
        occurred_at: item.occurred_at,
        confidence: item.confidence,
        liveness_score: item.liveness_score,
        device_label: item.device_label + " (Offline Synced)",
      });

      if (error) {
        throw error;
      }
      successCount++;
      if (onProgress) onProgress(successCount, unsynced.length);
    } catch (err) {
      console.warn("Failed to sync queued punch:", item.id, err);
      failCount++;
      remainingQueue.push(item);
    }
  }

  saveOfflineQueue(remainingQueue);

  if (successCount > 0) {
    toast.success(
      `Synchronized ${successCount} offline attendance ${successCount === 1 ? "punch" : "punches"} to cloud database.`,
    );
  }

  return { success: successCount, failed: failCount };
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [pendingCount, setPendingCount] = useState<number>(() => getOfflineQueue().length);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.info("Internet connection restored. Syncing offline records…");
      setSyncing(true);
      flushOfflineQueue()
        .then(() => setPendingCount(getOfflineQueue().length))
        .finally(() => setSyncing(false));
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("Internet disconnected. Kiosk operating in offline edge mode.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    const queue = getOfflineQueue();
    setPendingCount(queue.length);

    if (navigator.onLine && queue.length > 0) {
      setSyncing(true);
      flushOfflineQueue()
        .then(() => setPendingCount(getOfflineQueue().length))
        .finally(() => setSyncing(false));
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      await flushOfflineQueue();
      setPendingCount(getOfflineQueue().length);
    } finally {
      setSyncing(false);
    }
  };

  return {
    isOnline,
    pendingCount,
    syncing,
    triggerSync,
  };
}
