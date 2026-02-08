import { useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function NotificationsManager() {
  useEffect(() => {
    // Subscribe to CasparFilling creation events
    const unsubscribeCaspar = base44.entities.CasparFilling.subscribe((event) => {
      if (event.type === 'create') {
        toast.info("התקבל כספר חדש!", {
          description: `${event.data.full_name} - ${event.data.hotel}`,
          duration: 5000,
        });
      }
    });

    // Subscribe to Task creation events
    const unsubscribeTask = base44.entities.Task.subscribe((event) => {
      if (event.type === 'create') {
        toast.info("נוצרה משימה חדשה", {
          description: event.data.title,
          duration: 5000,
        });
      }
    });

    return () => {
      unsubscribeCaspar();
      unsubscribeTask();
    };
  }, []);

  return null;
}