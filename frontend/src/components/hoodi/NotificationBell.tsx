import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/hoodi/notifications.functions";
import { getMyProfile } from "@/lib/hoodi/profiles.functions";
import { supabase } from "@/integrations/supabase/client";
import { formatRelative } from "@/lib/hoodi/format";
import { cn } from "@/lib/utils";

export function NotificationBell({ className }: { className?: string }) {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const notifs = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listMyNotifications(),
    refetchInterval: 30_000,
  });

  const myId = me.data?.id;
  useEffect(() => {
    if (!myId) return;
    const ch = supabase
      .channel(`notif:${myId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${myId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [myId, qc]);

  const readOne = useMutation({
    mutationFn: (id: string) => markNotificationRead({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const items = notifs.data ?? [];
  const unread = items.filter((n) => !n.is_read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className={cn(
            "relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink-soft transition hover:bg-sand hover:text-ink",
            className,
          )}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-urgency-emergency px-1 text-[10px] font-bold text-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="font-display text-sm font-bold text-ink">Notifications</div>
          {unread > 0 && (
            <button
              onClick={() => readAll.mutate()}
              className="text-xs font-semibold text-ink-soft hover:text-ink"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">
              You're all caught up.
            </p>
          )}
          {items.map((n) => {
            const inner = (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className={cn("text-sm", n.is_read ? "text-ink-soft" : "text-ink font-medium")}>
                    {n.message}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {formatRelative(n.created_at)}
                  </div>
                </div>
                {!n.is_read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-urgency-emergency" />
                )}
              </div>
            );
            const cls = cn(
              "block border-b border-border/60 px-4 py-3 text-left transition hover:bg-sand/60",
              !n.is_read && "bg-sand/40",
            );
            const onClick = () => {
              if (!n.is_read) readOne.mutate(n.id);
            };
            return n.request_id ? (
              <Link
                key={n.id}
                to="/help/requests/$id"
                params={{ id: n.request_id }}
                className={cls}
                onClick={onClick}
              >
                {inner}
              </Link>
            ) : n.booking_id ? (
              <Link key={n.id} to="/skills/bookings" className={cls} onClick={onClick}>
                {inner}
              </Link>
            ) : (
              <button
                key={n.id}
                type="button"
                onClick={onClick}
                className={cn(cls, "w-full")}
              >
                {inner}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}