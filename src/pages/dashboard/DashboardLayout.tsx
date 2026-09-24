import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  CalendarDays,
  Heart,
  Star,
  Bell,
  MessageCircle,
  LogOut,
  Home,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { signOutUser, setAuthReturnTo } from "@/lib/auth";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useChat } from "@/chat/ChatContext";
import logoSrc from "../../assets/TravioGhana_Logo.svg";
import "../../components/booking/bookingTheme.css";
import "./DashboardLayout.css";

// Dashboard sub-pages are code-split so visiting one tab (e.g. Wishlist) only
// downloads that page's chunk instead of every dashboard page up front.
const SettingsPage = lazy(() => import("./AccountSettingsPage"));
const BookingHistory = lazy(() => import("../BookingHistory"));
const Wishlist = lazy(() => import("../Wishlist"));
const ReviewsPage = lazy(() => import("./ReviewsPage"));
const NotificationsPage = lazy(() => import("./NotificationsPage"));
const ChatPage = lazy(() => import("./ChatPage"));
const BookingModifyPage = lazy(() => import("../BookingModifyPage"));

// Shared leading tabs (identical on desktop and mobile)
type DashTab = {
  label: string;
  path: string;
  icon: typeof CalendarDays;
  /** Marks the tab that renders the chat unread badge. */
  badge?: string;
};

const baseTabs: DashTab[] = [
  { label: "Bookings", path: "/dashboard/bookings", icon: CalendarDays },
  { label: "Wishlist", path: "/dashboard/wishlist", icon: Heart },
  { label: "Reviews", path: "/dashboard/reviews", icon: Star },
];

// Desktop top bar: Bookings · Wishlist · Reviews · Chat · Notifications
// `badge` marks the item that shows the chat unread count.
const topBarItems: DashTab[] = [
  ...baseTabs,
  { label: "Chat", path: "/dashboard/chat", icon: MessageCircle, badge: "chat" },
  { label: "Notifications", path: "/dashboard/notifications", icon: Bell },
];

// Mobile bottom bar (unchanged): Bookings · Wishlist · Reviews · Updates · Chat · Settings
const allNavItems: DashTab[] = [
  ...baseTabs,
  { label: "Updates", path: "/dashboard/notifications", icon: Bell },
  { label: "Chat", path: "/dashboard/chat", icon: MessageCircle },
  { label: "Settings", path: "/dashboard/settings", icon: Settings },
];

const ROUTES = [
  { path: "/dashboard/settings", title: "Account Settings", Page: SettingsPage },
  { path: "/dashboard/bookings", title: "Booking History", Page: BookingHistory },
  { path: "/dashboard/wishlist", title: "My Wishlist", Page: Wishlist },
  { path: "/dashboard/reviews", title: "My Reviews", Page: ReviewsPage },
  { path: "/dashboard/notifications", title: "Updates", Page: NotificationsPage },
  { path: "/dashboard/chat", title: "Chat", Page: ChatPage },
] as const;

function isBookingsAreaPath(pathname: string): boolean {
  return pathname === "/dashboard/bookings";
}

/* ================================================================
   PROFILE DROPDOWN
   ================================================================ */
function ProfileDropdown({
  open,
  onClose,
  onSignOut,
  signingOut,
}: {
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const navigate = useNavigate();
  const user = useAuthUser();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          className="dash-profile-dropdown"
          role="menu"
          aria-label="User menu"
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -4 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          {/* User info header */}
          <div className="dash-profile-user">
            <div className="dash-profile-user-avatar">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  className="dash-profile-user-img"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <span className="dash-profile-user-initial">
                  {(user?.name || "U").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="dash-profile-user-info">
              <p className="dash-profile-user-name">{user?.name || "User"}</p>
              <p className="dash-profile-user-email">{user?.email || ""}</p>
            </div>
          </div>

          <div className="dash-profile-divider" />

          {/* Back to homepage */}
          <button
            role="menuitem"
            className="dash-profile-item"
            onClick={() => {
              onClose();
              navigate("/");
            }}
          >
            <Home size={16} strokeWidth={1.7} />
            <span>Back to Homepage</span>
          </button>

          {/* Account Settings */}
          <button
            role="menuitem"
            className="dash-profile-item"
            onClick={() => {
              onClose();
              navigate("/dashboard/settings");
            }}
          >
            <Settings size={16} strokeWidth={1.7} />
            <span>Account Settings</span>
          </button>

          {/* Sign out */}
          {!showLogoutConfirm ? (
            <button
              role="menuitem"
              className="dash-profile-item dash-profile-signout"
              onClick={() => setShowLogoutConfirm(true)}
            >
              <LogOut size={16} strokeWidth={1.7} />
              <span>{signingOut ? "Signing out..." : "Sign out"}</span>
            </button>
          ) : (
            <div className="dash-profile-signout-confirm">
              <p className="dash-profile-signout-text">Sign out of dashboard?</p>
              <div className="dash-profile-signout-actions">
                <button
                  className="dash-profile-signout-cancel"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="dash-profile-signout-btn"
                  onClick={onSignOut}
                  disabled={signingOut}
                >
                  {signingOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ================================================================
   TOP BAR (replaces Sidebar on desktop)
   ================================================================ */
function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthUser();
  const { unreadCount } = useChat();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOutUser();
    setSigningOut(false);
    navigate("/");
    toast.success("Successfully signed out");
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <>
      {/* Top bar */}
      <header className="dash-topbar">
        <div className="dash-topbar-inner">
          {/* Left: Logo */}
          <div className="dash-topbar-left">
            {/* Logo */}
            <a
              href="/"
              className="dash-topbar-logo"
              onClick={(e) => {
                e.preventDefault();
                navigate("/");
              }}
            >
              <img
                src={logoSrc}
                alt="Travio Ghana"
                className="dash-topbar-logo-img"
              />
            </a>
          </div>

          {/* Center: Nav tabs (desktop only) */}
          <nav className="dash-topbar-nav hidden lg:flex" aria-label="Dashboard navigation">
            {topBarItems.map((item) => {
              const active = isActive(item.path);
              const badge = item.badge === "chat" ? unreadCount : 0;
              return (
                <button
                  key={item.path}
                  className={`dash-topbar-tab${active ? " active" : ""}`}
                  onClick={() => navigate(item.path)}
                  aria-current={active ? "page" : undefined}
                >
                  {badge > 0 ? (
                    <span className="dash-topbar-icon-wrap">
                      <item.icon size={16} strokeWidth={active ? 2.2 : 1.7} />
                      <span className="dash-topbar-badge">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    </span>
                  ) : (
                    <item.icon size={16} strokeWidth={active ? 2.2 : 1.7} />
                  )}
                  <span>{item.label}</span>
                  {active && (
                    <motion.span
                      layoutId="topbar-active"
                      className="dash-topbar-underline"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right: Utilities */}
          <div className="dash-topbar-utilities">
            {/* Profile trigger */}
            <div ref={dropdownRef} className="relative">
              <button
                className="dash-profile-trigger"
                onClick={() => setDropdownOpen((v) => !v)}
                aria-expanded={dropdownOpen}
                aria-haspopup="menu"
              >
                <div className="dash-topbar-avatar">
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt=""
                      className="dash-topbar-avatar-img"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="dash-topbar-avatar-initial">
                      {(user?.name || "U").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="dash-topbar-name hidden sm:block">
                  {user?.name || "User"}
                </span>
                <ChevronDown
                  size={14}
                  className={`dash-topbar-chevron${dropdownOpen ? " open" : ""}`}
                />
              </button>

              <ProfileDropdown
                open={dropdownOpen}
                onClose={() => setDropdownOpen(false)}
                onSignOut={handleSignOut}
                signingOut={signingOut}
              />
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

/* ================================================================
   DASHBOARD LAYOUT
   ================================================================ */
export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadCount } = useChat();
  const user = useAuthUser();

  // Keep every visited dashboard page mounted (hidden, not unmounted) so
  // navigating away and back never remounts the page / refetches data.
  const [visited, setVisited] = useState<Set<string>>(
    () => new Set([location.pathname])
  );
  if (!visited.has(location.pathname)) {
    setVisited((prev) => new Set(prev).add(location.pathname));
  }

  const activeRoute = ROUTES.find((r) => r.path === location.pathname);
  // Self-service "Edit your trip" for one booking — a booking-scoped page that
  // keeps the dashboard chrome (top bar + mobile tabs) so the customer can jump
  // back to Bookings/Wishlist/etc. instead of being stranded on a bare page.
  const modifyMatch = location.pathname.match(/^\/dashboard\/bookings\/([^/]+)\/modify$/);
  const modifyBookingId = modifyMatch ? decodeURIComponent(modifyMatch[1]) : null;

  // Account settings requires an authenticated user — signed-out visitors are
  // sent to login and returned here after signing in.
  useEffect(() => {
    if (location.pathname === "/dashboard/settings" && !user) {
      setAuthReturnTo(location.pathname);
    }
  }, [location.pathname, user]);

  if (location.pathname === "/dashboard/settings" && !user) {
    return <Navigate to="/login" replace />;
  }

  if (!activeRoute && !modifyBookingId) {
    return <Navigate to="/dashboard/bookings" replace />;
  }
  const bookingsArea = isBookingsAreaPath(location.pathname) || !!modifyBookingId;

  return (
    <div className={`min-h-screen ${bookingsArea ? "bg-white" : "bg-[var(--dash-content-bg)]"}`}>
      <TopBar />

      <main className="min-h-screen dash-main-content">
        <div className="mx-auto w-full max-w-[1200px] px-6 pb-10">
          {modifyBookingId ? (
            /* "Edit your trip" — booking-scoped page inside the dashboard chrome. */
            <div className="dash-modify-wrap">
              <Suspense
                fallback={
                  <div className="dash-page-skeleton">
                    <div className="dash-page-skeleton-bar w-1/3" />
                    <div className="dash-page-skeleton-bar w-2/3" />
                    <div className="dash-page-skeleton-bar w-1/2" />
                  </div>
                }
              >
                <BookingModifyPage key={`modify-${modifyBookingId}`} bookingId={modifyBookingId} />
              </Suspense>
            </div>
          ) : activeRoute ? (
            <>
              <div className="flex items-center justify-center lg:justify-start mb-4 relative">
                {location.pathname !== "/dashboard/notifications" && (
                  <h1 className="text-[clamp(24px,2.4vw,32px)] font-heading font-bold text-[var(--bv-ink)] text-center lg:text-left">
                    {activeRoute.title}
                  </h1>
                )}

                {location.pathname === "/dashboard/settings" && (
                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="lg:hidden absolute right-0 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--bv-border)] bg-white text-[var(--bv-text)] shadow-sm transition-colors hover:bg-[var(--bv-surface-2)]"
                    aria-label="Back to home"
                  >
                    <ArrowLeft size={16} strokeWidth={2.2} />
                  </button>
                )}
              </div>

              <div className="dash-pages">
                {ROUTES.map((r) => {
                  if (!visited.has(r.path)) return null;
                  const active = r.path === location.pathname;
                  return (
                    <section
                      key={r.path}
                      className={`dash-pane${active ? " active" : ""}`}
                      hidden={!active}
                    >
                      <Suspense
                        fallback={
                          <div className="dash-page-skeleton">
                            <div className="dash-page-skeleton-bar w-1/3" />
                            <div className="dash-page-skeleton-bar w-2/3" />
                            <div className="dash-page-skeleton-bar w-1/2" />
                          </div>
                        }
                      >
                        <r.Page />
                      </Suspense>
                    </section>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="dash-bottom-bar lg:hidden" aria-label="Dashboard navigation">
        <div className="dash-bottom-bar-inner">
          {allNavItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              location.pathname.startsWith(item.path + "/");
            const badge =
              item.path === "/dashboard/chat" ? unreadCount : 0;
            return (
              <motion.button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`dash-bottom-tab${isActive ? " active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                whileTap={{ scale: 0.88 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                <span className="dash-bottom-icon-wrap">
                  <motion.span
                    className="dash-bottom-icon"
                    animate={{ scale: isActive ? 1.08 : 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 25,
                    }}
                  >
                    <item.icon
                      size={22}
                      strokeWidth={isActive ? 2.2 : 1.7}
                    />
                  </motion.span>
                  {badge > 0 && (
                    <span className="dash-bottom-badge">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
                <span className="dash-bottom-label">{item.label}</span>
                {isActive && <span className="dash-bottom-active-dot" />}
              </motion.button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
