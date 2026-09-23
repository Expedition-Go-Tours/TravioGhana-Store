import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, CheckCheck, Trash2, Settings, Info, CalendarCheck, CalendarX2,
  MessageCircle, CreditCard, Star, ExternalLink, MapPin, Clock, DollarSign,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { fetchWithAuth } from "@/lib/api";
import { useChat } from "@/chat/ChatContext";
import { useComingSoon } from "@/hooks/useComingSoon";
import "./NotificationsPage.css";

/* ── Types ──────────────────────────────────────────────────────── */
interface BackendNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: {
    conversationId?: string;
    senderId?: string;
    bookingId?: string;
    tourName?: string;
    tourId?: string;
    tourSlug?: string;
    tourTitle?: string;
    source?: string;
    clientOrigin?: string;
    travelDate?: string;
    amount?: number;
    currency?: string;
    refundPercentage?: number;
  } | null;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
}

interface NotificationPageData {
  notifications: BackendNotification[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    unreadCount: number;
  };
}

/* ── Notification type config ───────────────────────────────────── */
const typeConfig: Record<
  string,
  { icon: typeof Bell; colorClass: string; iconClass: string; label: string }
> = {
  BOOKING_CONFIRMED: {
    icon: CalendarCheck,
    colorClass: "booking-confirmed",
    iconClass: "",
    label: "Booking",
  },
  BOOKING_CANCELLED: {
    icon: CalendarX2,
    colorClass: "booking-cancelled",
    iconClass: "",
    label: "Booking",
  },
  PAYMENT_RECEIVED: {
    icon: CreditCard,
    colorClass: "payment",
    iconClass: "",
    label: "Payment",
  },
  REVIEW_RECEIVED: {
    icon: Star,
    colorClass: "review",
    iconClass: "",
    label: "Review",
  },
  REVIEW_REQUEST: {
    icon: Star,
    colorClass: "review",
    iconClass: "",
    label: "Review",
  },
  NEW_MESSAGE: {
    icon: MessageCircle,
    colorClass: "message",
    iconClass: "",
    label: "Message",
  },
  SYSTEM_ALERT: {
    icon: Info,
    colorClass: "system",
    iconClass: "",
    label: "System",
  },
};

const DEFAULT_CONFIG = {
  icon: Bell,
  colorClass: "system",
  iconClass: "",
  label: "Update",
};

/* ── Filter definitions ─────────────────────────────────────────── */
type FilterKey = "all" | "unread" | "booking" | "message" | "payment" | "review";

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "booking", label: "Bookings" },
  { key: "message", label: "Messages" },
  { key: "payment", label: "Payments" },
  { key: "review", label: "Reviews" },
];

function matchesFilter(n: BackendNotification, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "unread") return !n.read;
  if (filter === "booking")
    return n.type === "BOOKING_CONFIRMED" || n.type === "BOOKING_CANCELLED";
  if (filter === "message") return n.type === "NEW_MESSAGE";
  if (filter === "payment") return n.type === "PAYMENT_RECEIVED";
  if (filter === "review") return n.type === "REVIEW_RECEIVED" || n.type === "REVIEW_REQUEST";
  return true;
}

/* ── Helpers ────────────────────────────────────────────────────── */
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

function getDateGroup(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 86400000);

  if (date >= startOfToday) return "Today";
  if (date >= startOfYesterday) return "Yesterday";
  if (date >= startOfWeek) return "This Week";
  return "Earlier";
}

function formatCurrency(amount?: number, currency?: string): string | null {
  if (amount == null) return null;
  const sym = currency === "GHS" ? "₵" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  return `${sym}${amount.toLocaleString()}`;
}

function formatDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ── Deep-link resolver ─────────────────────────────────────────── */
type NavTarget = { path: string; state?: Record<string, unknown> } | { url: string } | null;

function getNotificationTarget(n: BackendNotification): NavTarget {
  if (n.type === "NEW_MESSAGE" && n.data?.conversationId) {
    return { path: `/dashboard/chat?conversation=${n.data.conversationId}` };
  }
  if (
    (n.type === "BOOKING_CONFIRMED" || n.type === "BOOKING_CANCELLED") &&
    n.data?.bookingId
  ) {
    return { path: `/dashboard/bookings?booking=${n.data.bookingId}` };
  }
  if (n.type === "PAYMENT_RECEIVED" && n.data?.bookingId) {
    return { path: `/dashboard/bookings?booking=${n.data.bookingId}` };
  }
  if (n.type === "REVIEW_RECEIVED") {
    return { path: "/dashboard/reviews" };
  }
  if (n.type === "REVIEW_REQUEST" && n.data?.bookingId) {
    const { bookingId, tourId, tourSlug, tourTitle, clientOrigin } = n.data;
    // The booking was made on another brand's storefront — open that app's
    // review page so the customer can actually review it.
    const appOrigin = typeof window !== "undefined" ? window.location.origin : "";
    if (clientOrigin && appOrigin && clientOrigin !== appOrigin) {
      const params = new URLSearchParams({ bookingId });
      if (tourId) params.set("tourId", tourId);
      const slug = encodeURIComponent(tourSlug || tourId || bookingId);
      return { url: `${clientOrigin}/review/${slug}?${params.toString()}` };
    }
    if (tourSlug) {
      return {
        path: `/review/${encodeURIComponent(tourSlug)}`,
        state: {
          bookingId,
          returnTo: "/dashboard/notifications",
          tour: { title: tourTitle || undefined, slug: tourSlug, tourId: tourId || undefined },
        },
      };
    }
    // No slug — the booking workspace still offers its own "write a review" CTA.
    return { path: `/dashboard/bookings?booking=${bookingId}` };
  }
  return null;
}

function getActionLabel(n: BackendNotification): string | null {
  if (n.type === "NEW_MESSAGE") return "Open Chat";
  if (n.type === "BOOKING_CONFIRMED" || n.type === "BOOKING_CANCELLED") return "View Booking";
  if (n.type === "PAYMENT_RECEIVED") return "View Booking";
  if (n.type === "REVIEW_RECEIVED") return "View Reviews";
  if (n.type === "REVIEW_REQUEST") return "Write a review";
  return null;
}

/* ── Component ──────────────────────────────────────────────────── */
export default function NotificationsPage() {
  const navigate = useNavigate();
  const comingSoon = useComingSoon();
  const chat = useChat();
  const [notifications, setNotifications] = useState<BackendNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState({
    BOOKING_CONFIRMED: true,
    BOOKING_CANCELLED: true,
    PAYMENT_RECEIVED: true,
    REVIEW_RECEIVED: true,
    REVIEW_REQUEST: true,
    NEW_MESSAGE: true,
    SYSTEM_ALERT: true,
  });

  /* ── Fetch ─────────────────────────────────────────────────────── */
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

  useEffect(() => {
    void Promise.resolve().then(fetchNotifications);
    const onFocus = () => fetchNotifications();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchNotifications, chat.unreadCount]);

  /* ── Actions ────────────────────────────────────────────────────── */
  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    fetchWithAuth(`/notifications/${id}/read`, { method: "PATCH" }).catch(() => {});
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
    fetchWithAuth("/notifications/mark-all-read", { method: "PATCH" }).catch(() => {});
  };

  const removeOne = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    fetchWithAuth(`/notifications/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const activate = (target: NavTarget) => {
    if (!target) return;
    if ("url" in target) {
      window.location.assign(target.url);
    } else {
      navigate(target.path, { state: target.state });
    }
  };

  const handleCardClick = (n: BackendNotification) => {
    if (!n.read) markRead(n.id);
    activate(getNotificationTarget(n));
  };

  /* ── Derived ────────────────────────────────────────────────────── */
  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = useMemo(
    () => notifications.filter((n) => matchesFilter(n, filter)),
    [notifications, filter],
  );

  const filterCounts = useMemo(() => {
    const counts: Record<FilterKey, number> = {
      all: notifications.length,
      unread: 0,
      booking: 0,
      message: 0,
      payment: 0,
      review: 0,
    };
    for (const n of notifications) {
      if (!n.read) counts.unread++;
      if (n.type === "BOOKING_CONFIRMED" || n.type === "BOOKING_CANCELLED") counts.booking++;
      if (n.type === "NEW_MESSAGE") counts.message++;
      if (n.type === "PAYMENT_RECEIVED") counts.payment++;
      if (n.type === "REVIEW_RECEIVED" || n.type === "REVIEW_REQUEST") counts.review++;
    }
    return counts;
  }, [notifications]);

  const grouped = useMemo(() => {
    const groups: Record<string, BackendNotification[]> = {};
    for (const n of filtered) {
      const group = getDateGroup(n.createdAt);
      if (!groups[group]) groups[group] = [];
      groups[group].push(n);
    }
    const order = ["Today", "Yesterday", "This Week", "Earlier"];
    return order.filter((g) => groups[g]?.length).map((g) => ({ label: g, items: groups[g] }));
  }, [filtered]);

  /* ── Loading skeleton ───────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="w-full mx-auto" role="status" aria-label="Loading notifications">
        <div className="notif-header">
          <div className="notif-header-left">
            <div className="notif-header-icon"><Bell size={22} /></div>
            <div className="notif-header-text">
              <h1>Updates</h1>
              <p className="notif-header-subtitle">Loading your notifications...</p>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="notif-skeleton" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="notif-skeleton-icon" />
              <div className="notif-skeleton-content">
                <div className="notif-skeleton-line title" />
                <div className="notif-skeleton-line text" />
                <div className="notif-skeleton-line short" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Empty state ────────────────────────────────────────────────── */
  if (notifications.length === 0) {
    return (
      <div className="w-full mx-auto">
        <div className="notif-header">
          <div className="notif-header-left">
            <div className="notif-header-icon"><Bell size={22} /></div>
            <div className="notif-header-text">
              <h1>Updates</h1>
              <p className="notif-header-subtitle">You're all caught up</p>
            </div>
          </div>
        </div>
        <div className="notif-empty">
          <div className="notif-empty-icon">
            <Bell size={32} />
          </div>
          <h2 className="notif-empty-title">All Clear!</h2>
          <p className="notif-empty-text">
            You have no notifications yet. We'll let you know when there's booking
            updates, messages from operators, or payment confirmations.
          </p>
          <div className="notif-empty-features">
            <span className="notif-empty-feature">
              <CalendarCheck size={14} /> Booking updates
            </span>
            <span className="notif-empty-feature">
              <MessageCircle size={14} /> Operator messages
            </span>
            <span className="notif-empty-feature">
              <CreditCard size={14} /> Payment confirmations
            </span>
            <span className="notif-empty-feature">
              <Star size={14} /> Review reminders
            </span>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main render ────────────────────────────────────────────────── */
  return (
    <div className="w-full mx-auto">
      {/* Header */}
      <div className="notif-header">
        <div className="notif-header-left">
          <div className="notif-header-icon">
            <Bell size={22} />
          </div>
          <div className="notif-header-text">
            <h1>Updates</h1>
            <p className="notif-header-subtitle">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                : "You're all caught up"}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <div className="notif-unread-badge">
            <span className="notif-unread-count">{unreadCount}</span>
            unread
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="notif-actions">
        <div className="notif-actions-left">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="notif-action-link primary"
              aria-label="Mark all notifications as read"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>
        <button
          onClick={() => setShowPrefs(true)}
          className="notif-action-link subtle"
          aria-label="Notification preferences"
        >
          <Settings size={14} />
          Preferences
        </button>
      </div>

      {/* Filter tabs */}
      <div className="notif-filters" role="tablist" aria-label="Filter notifications">
        {filters.map((f) => (
          <button
            key={f.key}
            className={`notif-filter ${filter === f.key ? "active" : ""}`}
            onClick={() => setFilter(f.key)}
            role="tab"
            aria-selected={filter === f.key}
            aria-label={`${f.label}${filterCounts[f.key] > 0 ? `, ${filterCounts[f.key]} notifications` : ""}`}
          >
            {f.label}
            {filterCounts[f.key] > 0 && (
              <span className="notif-filter-count">{filterCounts[f.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div role="list" aria-label="Notifications">
        {grouped.map((group) => (
          <div key={group.label} style={{ marginBottom: 24 }}>
            <div className="notif-date-group">
              <span className="notif-date-group-label">{group.label}</span>
              <div className="notif-date-group-line" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <AnimatePresence>
                {group.items.map((notification) => {
                  const config = typeConfig[notification.type] ?? DEFAULT_CONFIG;
                  const Icon = config.icon;
                  const isUnread = !notification.read;
                  const isUrgent = notification.type === "BOOKING_CANCELLED";
                  const target = getNotificationTarget(notification);
                  const actionLabel = getActionLabel(notification);
                  const tourName = notification.data?.tourName;
                  const travelDate = notification.data?.travelDate;
                  const amount = notification.data?.amount;
                  const currency = notification.data?.currency;

                  return (
                    <motion.div
                      key={notification.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.18 }}
                      className={`notif-card ${isUnread ? "unread" : ""} ${isUrgent ? "urgent" : ""}`}
                      onClick={() => handleCardClick(notification)}
                      role="listitem"
                      aria-label={`${config.label}: ${notification.title}. ${
                        isUnread ? "Unread." : ""
                      } ${timeAgo(notification.createdAt)}`}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleCardClick(notification);
                        }
                      }}
                    >
                      {isUnread && <span className="notif-unread-dot" />}

                      <div className={`notif-icon ${config.colorClass}`}>
                        <Icon size={20} />
                      </div>

                      <div className="notif-content">
                        <div className="notif-title-row">
                          <h3 className="notif-title">{notification.title}</h3>
                          <span className="notif-time">{timeAgo(notification.createdAt)}</span>
                        </div>

                        <p className="notif-message">{notification.message}</p>

                        {/* Rich metadata chips */}
                        {(tourName || travelDate || amount != null) && (
                          <div className="notif-meta">
                            {tourName && (
                              <span className="notif-meta-chip">
                                <MapPin size={12} />
                                {tourName}
                              </span>
                            )}
                            {travelDate && (
                              <span className="notif-meta-chip date">
                                <Clock size={12} />
                                {formatDate(travelDate)}
                              </span>
                            )}
                            {amount != null && (
                              <span className="notif-meta-chip amount">
                                <DollarSign size={12} />
                                {formatCurrency(amount, currency)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Card actions */}
                        <div className="notif-card-actions">
                          {target && actionLabel && (
                            <button
                              className="notif-action-link primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                activate(target);
                              }}
                            >
                              {actionLabel}
                              <ExternalLink size={12} />
                            </button>
                          )}
                          {!isUnread && (
                            <button
                              className="notif-action-link subtle"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeOne(notification.id);
                              }}
                            >
                              <Trash2 size={12} />
                              Dismiss
                            </button>
                          )}
                          {isUnread && (
                            <button
                              className="notif-action-link subtle"
                              onClick={(e) => {
                                e.stopPropagation();
                                markRead(notification.id);
                              }}
                            >
                              <CheckCheck size={12} />
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      {/* Empty filtered state */}
      {filtered.length === 0 && notifications.length > 0 && (
        <div className="notif-empty" style={{ padding: "48px 24px" }}>
          <div className="notif-empty-icon" style={{ width: 56, height: 56 }}>
            <Bell size={24} />
          </div>
          <h2 className="notif-empty-title" style={{ fontSize: 16 }}>
            No {filter !== "all" ? filters.find((f) => f.key === filter)?.label.toLowerCase() : ""} notifications
          </h2>
          <p className="notif-empty-text" style={{ fontSize: 13, maxWidth: 260 }}>
            {filter === "unread"
              ? "All notifications have been read. Nice work!"
              : "No notifications match this filter."}
          </p>
        </div>
      )}

      {/* Preferences modal */}
      <AnimatePresence>
        {showPrefs && (
          <motion.div
            className="notif-prefs-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setShowPrefs(false)}
          >
            <motion.div
              className="notif-prefs-modal"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Notification preferences"
            >
              <div className="notif-prefs-header">
                <h2>Notification Preferences</h2>
                <button
                  className="notif-prefs-close"
                  onClick={() => setShowPrefs(false)}
                  aria-label="Close preferences"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="notif-prefs-body">
                <div className="notif-prefs-section">
                  <p className="notif-prefs-section-title">Notification Types</p>

                  {[
                    { key: "BOOKING_CONFIRMED", label: "Booking Confirmed", desc: "When your booking is confirmed", icon: CalendarCheck, bg: "var(--notif-booking-confirmed-bg)", fg: "var(--notif-booking-confirmed-fg)" },
                    { key: "BOOKING_CANCELLED", label: "Booking Cancelled", desc: "When a booking is cancelled", icon: CalendarX2, bg: "var(--notif-booking-cancelled-bg)", fg: "var(--notif-booking-cancelled-fg)" },
                    { key: "PAYMENT_RECEIVED", label: "Payment Updates", desc: "Payment confirmations and receipts", icon: CreditCard, bg: "var(--notif-payment-bg)", fg: "var(--notif-payment-fg)" },
                    { key: "REVIEW_RECEIVED", label: "Review Reminders", desc: "Reminders to leave reviews", icon: Star, bg: "var(--notif-review-bg)", fg: "var(--notif-review-fg)" },
                    { key: "REVIEW_REQUEST", label: "Trip Complete", desc: "When a completed trip is ready for your review", icon: Star, bg: "var(--notif-review-bg)", fg: "var(--notif-review-fg)" },
                    { key: "NEW_MESSAGE", label: "Messages", desc: "Direct messages from operators", icon: MessageCircle, bg: "var(--notif-message-bg)", fg: "var(--notif-message-fg)" },
                    { key: "SYSTEM_ALERT", label: "System Alerts", desc: "Important platform updates", icon: Info, bg: "var(--notif-system-bg)", fg: "var(--notif-system-fg)" },
                  ].map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <div className="notif-prefs-row" key={item.key}>
                        <div className="notif-prefs-row-left">
                          <div
                            className="notif-prefs-row-icon"
                            style={{ background: item.bg, color: item.fg }}
                          >
                            <ItemIcon size={16} />
                          </div>
                          <div>
                            <p className="notif-prefs-row-label">{item.label}</p>
                            <p className="notif-prefs-row-desc">{item.desc}</p>
                          </div>
                        </div>
                        <button
                          className={`notif-toggle ${prefs[item.key as keyof typeof prefs] ? "on" : ""}`}
                          onClick={() =>
                            setPrefs((prev) => ({
                              ...prev,
                              [item.key]: !prev[item.key as keyof typeof prev],
                            }))
                          }
                          role="switch"
                          aria-checked={prefs[item.key as keyof typeof prefs]}
                          aria-label={`Toggle ${item.label} notifications`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="notif-prefs-footer">
                <button
                  className="notif-prefs-btn secondary"
                  onClick={() => setShowPrefs(false)}
                >
                  Cancel
                </button>
                <button
                  className="notif-prefs-btn primary is-coming-soon"
                  {...comingSoon}
                >
                  Save Preferences
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
