import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, CheckCheck, Trash2, Info, CalendarCheck, MessageCircle, CreditCard, Star, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchWithAuth } from "@/lib/api";
import { useChat } from "@/chat/ChatContext";

interface BackendNotification {
  id: string
  type: string
  title: string
  message: string
  data?: { conversationId?: string; senderId?: string } | null
  read: boolean
  readAt?: string | null
  createdAt: string
}

interface NotificationPageData {
  notifications: BackendNotification[]
  pagination: { page: number; limit: number; totalCount: number; totalPages: number; unreadCount: number }
}

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  BOOKING_CONFIRMED: { icon: CalendarCheck, color: "text-[#065f46]", bg: "bg-[#ecfdf5]" },
  BOOKING_CANCELLED: { icon: CalendarCheck, color: "text-[#b91c1c]", bg: "bg-[#fef2f2]" },
  PAYMENT_RECEIVED: { icon: CreditCard, color: "text-[#1d4ed8]", bg: "bg-blue-50" },
  REVIEW_RECEIVED: { icon: Star, color: "text-[#d97706]", bg: "bg-amber-50" },
  NEW_MESSAGE: { icon: MessageCircle, color: "text-[#179237]", bg: "bg-[#f0fdf4]" },
  SYSTEM_ALERT: { icon: Info, color: "text-[#2563eb]", bg: "bg-blue-50" },
};

const DEFAULT_CONFIG = { icon: Bell, color: "text-[#6b7280]", bg: "bg-[#f3f4f6]" };

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const chat = useChat();
  const [notifications, setNotifications] = useState<BackendNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/notifications?page=1&limit=50");
      if (!res.ok) return;
      const payload = await res.json().catch(() => ({}));
      const data = (payload.data ?? payload) as NotificationPageData;
      setNotifications(data.notifications ?? []);
    } catch {
      /* transient */
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount, on focus, and whenever a new chat message arrives (the
  // chat context unread counter moves on socket chat:message events).
  useEffect(() => {
    void Promise.resolve().then(fetchNotifications);
    const onFocus = () => fetchNotifications();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchNotifications, chat.unreadCount]);

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    fetchWithAuth(`/notifications/${id}/read`, { method: "PATCH" }).catch(() => {});
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
    fetchWithAuth("/notifications/mark-all-read", { method: "PATCH" }).catch(() => {});
  };

  const clearAll = async () => {
    setNotifications([]);
    toast.success("All notifications cleared");
    fetchWithAuth("/notifications/mark-all-read", { method: "PATCH" }).catch(() => {});
  };

  const removeOne = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    fetchWithAuth(`/notifications/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#6b7280]">Loading notifications…</div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-[#e5e4e7] w-full max-w-4xl mx-auto">
        <Bell size={56} className="text-[#065f46] opacity-50 mb-5" />
        <h3 className="text-xl font-heading font-semibold text-[#1a1a1a] mb-2">All Clear!</h3>
        <p className="text-[14px] text-[#6b7280] max-w-sm leading-relaxed mb-7">
          You have no notifications. We'll notify you when something new comes in.
        </p>
        <Button className="bg-[#065f46] text-white hover:bg-[#047857]" onClick={() => navigate("/")}>
          Explore Tours
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <p className="text-[14px] text-[#6b7280]">
          {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up"}
        </p>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-[13px] font-medium text-[#065f46] hover:underline"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#6b7280] hover:text-[#ef4444] transition-colors"
          >
            <Trash2 size={14} />
            Clear all
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {notifications.map((notification) => {
            const config = typeConfig[notification.type] ?? DEFAULT_CONFIG;
            const isChat = notification.type === "NEW_MESSAGE";
            const conversationId = notification.data?.conversationId;

            return (
              <motion.div
                key={notification.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -30, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => markRead(notification.id)}
                className={`relative flex gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                  notification.read
                    ? "bg-white border border-[#e5e4e7]"
                    : "bg-[#f8fafc] border border-[#065f46]/10 shadow-sm"
                }`}
              >
                {!notification.read && (
                  <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[#065f46]" />
                )}

                <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
                  <config.icon size={18} className={config.color} />
                </div>

                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className={`text-[15px] font-semibold text-[#1a1a1a] ${notification.read ? "opacity-60" : ""}`}>
                      {notification.title}
                    </h4>
                    <span className="text-[12px] text-[#9ca3af] whitespace-nowrap shrink-0 mt-0.5">
                      {timeAgo(notification.createdAt)}
                    </span>
                  </div>
                  <p className={`text-[14px] mt-1 leading-relaxed ${notification.read ? "text-[#9ca3af]" : "text-[#6b7280]"}`}>
                    {notification.message}
                  </p>
                  {isChat && conversationId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/dashboard/chat?conversation=${conversationId}`);
                      }}
                      className="flex items-center gap-1 text-[13px] font-medium text-[#065f46] mt-2 hover:underline"
                    >
                      View chat
                      <ExternalLink size={12} />
                    </button>
                  )}
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[#e5e4e7]">
                    {!notification.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead(notification.id);
                        }}
                        className="text-[12px] font-medium text-[#065f46] hover:underline"
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeOne(notification.id);
                      }}
                      className="text-[12px] font-medium text-[#9ca3af] hover:text-[#ef4444] transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
