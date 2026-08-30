import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, CalendarDays, Heart, Star, Bell, MessageCircle,
  LogOut, ChevronLeft, ChevronRight, Menu, Home, ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { useSidebarStore } from "@/stores/sidebarStore";
import { getStoredAuthUser, signOutUser } from "@/lib/auth";
import { useChat } from "@/chat/ChatContext";
import BookingHistory from "@/pages/BookingHistory";
import Wishlist from "@/pages/Wishlist";
import SettingsPage from "./SettingsPage";
import ReviewsPage from "./ReviewsPage";
import NotificationsPage from "./NotificationsPage";
import ChatPage from "./ChatPage";

const navItems = [
  { label: "Booking History", path: "/dashboard/bookings", icon: CalendarDays },
  { label: "Wishlist", path: "/dashboard/wishlist", icon: Heart },
  { label: "Reviews", path: "/dashboard/reviews", icon: Star },
  { label: "Updates", path: "/dashboard/notifications", icon: Bell },
  { label: "Chat", path: "/dashboard/chat", icon: MessageCircle },
  { label: "Settings", path: "/dashboard/settings", icon: Settings },
];

const pageTitles: Record<string, string> = {
  "/dashboard/settings": "Account Settings",
  "/dashboard/bookings": "Booking History",
  "/dashboard/wishlist": "My Wishlist",
  "/dashboard/reviews": "My Reviews",
  "/dashboard/notifications": "Updates",
  "/dashboard/chat": "Chat",
};

function Sidebar() {
  const { isCollapsed, toggle, isMobileOpen, closeMobile, toggleMobile } = useSidebarStore();
  const location = useLocation();
  const navigate = useNavigate();
  const user = getStoredAuthUser();
  const { unreadCount } = useChat();
  const [signingOut, setSigningOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const sinceDate = "Jul 2026";

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOutUser();
    setSigningOut(false);
    navigate("/");
    toast.success("Successfully signed out");
  };

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={toggleMobile}
        className={`fixed top-0 left-0 z-[70] p-3 rounded-br-xl bg-[#065f46] text-white shadow-lg hover:bg-[#047857] transition-colors ${isMobileOpen ? "hidden" : "lg:hidden"}`}
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen bg-[#065f46] z-50 flex flex-col
          ${mounted ? "transition-transform duration-[500ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]" : ""}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
          ${isCollapsed ? "lg:w-[64px] lg:translate-x-0" : "lg:w-[300px] lg:translate-x-0"}
          w-[280px]`}
      >
        {/* Profile */}
        <div className={`shrink-0 ${isCollapsed ? "flex flex-col items-center pt-8 pb-4" : "flex flex-col items-center px-6 pt-8 pb-6"}`}>
          <div className={`${isCollapsed ? "flex flex-col items-center gap-2" : "flex flex-col items-center gap-1.5"}`}>
            <div className={`rounded-full overflow-hidden bg-white/15 ring-2 ring-white/20 shrink-0 flex items-center justify-center ${isCollapsed ? "w-10 h-10" : "w-[52px] h-[52px]"}`}>
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" className="w-full h-full object-cover object-center" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              ) : (
                <span className="text-lg font-bold text-white">
                  {(user?.name || "U").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <div className="text-center min-w-0 mt-1">
                <p className="text-sm font-semibold text-white truncate leading-tight">
                  {user?.name || "User"}
                </p>
                <p className="text-[11px] text-white/50 truncate leading-relaxed">{user?.email || ""}</p>
                <p className="text-[10px] text-white/30 mt-0.5">Member since {sinceDate}</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 scrollbar-none">
          <div className={`space-y-[2px] ${isCollapsed ? "px-2 mt-3" : "px-4 mt-4"}`}>
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                location.pathname.startsWith(item.path + "/");

              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    closeMobile();
                  }}
                  className={`relative flex items-center w-full rounded-lg text-sm font-medium transition-all duration-200 group
                    ${isActive
                      ? "bg-white/15 text-white font-semibold"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                    }
                    ${isCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  {isActive && (
                    <motion.span
                      layoutId="active-indicator"
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                      className="absolute left-0 inset-y-2.5 w-[3px] bg-white rounded-r-full"
                    />
                  )}
                  <motion.span
                    layout
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    className="shrink-0"
                  >
                    <item.icon size={20} />
                  </motion.span>
                  {!isCollapsed && (
                    <span className="truncate text-[15px]">{item.label}</span>
                  )}
                  {item.path === "/dashboard/chat" && unreadCount > 0 && (
                    <span className={`ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4444] text-white text-[11px] font-bold flex items-center justify-center ${isCollapsed ? "absolute top-1 right-1" : ""}`}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-white text-[#333] text-xs font-medium rounded-lg shadow-lg border border-[#eaeaea] whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-[70]">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Bottom actions */}
        <div className={`shrink-0 ${isCollapsed ? "space-y-[2px] px-2" : "space-y-[2px] px-4"}`}>
          <button
            onClick={() => { navigate("/"); closeMobile(); }}
            className={`flex items-center w-full rounded-lg text-sm font-medium transition-all duration-200 text-white/50 hover:text-white hover:bg-white/10
              ${isCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"}`}
            title={isCollapsed ? "Back to Homepage" : undefined}
          >
            <Home size={20} />
            {!isCollapsed && <span className="text-[15px]">Back to Homepage</span>}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowLogoutConfirm(!showLogoutConfirm)}
              onBlur={() => setTimeout(() => setShowLogoutConfirm(false), 200)}
              className={`flex items-center w-full rounded-lg text-sm font-medium transition-all duration-200 text-white/50 hover:text-red-300 hover:bg-white/5
                ${isCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"}`}
              title={isCollapsed ? "Sign out" : undefined}
            >
              <LogOut size={20} />
              {!isCollapsed && <span className="text-[15px]">{signingOut ? "Signing out..." : "Sign out"}</span>}
            </button>
            {showLogoutConfirm && (
              <div className={`absolute bottom-full mb-2 bg-white rounded-xl shadow-xl shadow-black/10 p-3 min-w-[200px] z-[70] border border-[#eaeaea] ${isCollapsed ? "left-0" : "left-1/2 -translate-x-1/2"}`}>
                <p className="text-xs font-medium text-[#464255] mb-2.5 text-center whitespace-nowrap">Sign out of dashboard?</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-[#64748b] bg-[#f5f5f5] hover:bg-[#eaeaea] rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Collapse button */}
        <div className={`shrink-0 hidden lg:block ${isCollapsed ? "px-2 pt-4 pb-4" : "px-4 pt-3 pb-4"}`}>
          <button
            onClick={toggle}
            className={`flex items-center w-full rounded-lg text-sm font-medium transition-all duration-200 text-white/40 hover:text-white hover:bg-white/10
              ${isCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"}`}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight size={17} /> : (
              <>
                <ChevronLeft size={17} />
                <span className="text-[13px]">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            className="fixed inset-0 bg-black/30 z-[45] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeMobile}
          />
        )}
      </AnimatePresence>
    </>
  );
}

const pageVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -14 },
};

function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function DashboardLayout() {
  const { isCollapsed } = useSidebarStore();
  const location = useLocation();
  const navigate = useNavigate();
  const title = pageTitles[location.pathname] || "Dashboard";

  // Redirect the base /dashboard path (or any unknown dashboard subpath) to a
  // concrete page BEFORE entering the animated <Routes>. Rendering <Navigate>
  // as a keyed child inside an AnimatePresence with mode="wait" leaves the view
  // blank, because the redirect outputs null and never signals exit-completion.
  const isKnownRoute = Object.keys(pageTitles).includes(location.pathname);
  if (!isKnownRoute) {
    return <Navigate to="/dashboard/settings" replace />;
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <Sidebar />

      <main
        className={`min-h-screen transition-all duration-300 pt-6 lg:pt-10 ${
          isCollapsed ? "lg:ml-[64px]" : "lg:ml-[300px]"
        }`}
      >
        <div className="px-4 sm:px-6 lg:px-10 pb-10">
          <div className="flex items-center justify-center lg:justify-start mb-8 relative">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="absolute right-0 lg:static lg:mr-3 flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e4e7] bg-white text-[#1a1a1a] shadow-sm transition-colors hover:bg-[#f8f9fb]"
              aria-label="Back to home"
              title="Back to home"
            >
              <ArrowLeft size={16} strokeWidth={2.2} />
            </button>

            <AnimatePresence mode="wait">
              <motion.h1
                key={location.pathname}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="text-[clamp(24px,2.4vw,32px)] font-heading font-bold text-[#1a1a1a] text-center lg:text-left"
              >
                {title}
              </motion.h1>
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="settings" element={<AnimatedPage><SettingsPage /></AnimatedPage>} />
              <Route path="bookings" element={<AnimatedPage><BookingHistory /></AnimatedPage>} />
              <Route path="wishlist" element={<AnimatedPage><Wishlist /></AnimatedPage>} />
            <Route path="reviews" element={<AnimatedPage><ReviewsPage /></AnimatedPage>} />
            <Route path="notifications" element={<AnimatedPage><NotificationsPage /></AnimatedPage>} />
            <Route path="chat" element={<AnimatedPage><ChatPage /></AnimatedPage>} />
          </Routes>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
