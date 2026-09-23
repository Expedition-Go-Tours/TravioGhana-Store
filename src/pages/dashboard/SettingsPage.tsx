import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, MapPin, Lock, Camera, CalendarDays, Heart, Star } from "lucide-react";
import { getStoredAuthUser } from "@/lib/auth";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useMyExpeditionBookings } from "../../hooks/useExpeditionBookings";
import { useWishlist } from "../../context/WishlistContext";
import { useMyReviews } from "../../hooks/useExpeditionReviews";
import { Input } from "@/components/ui/input";
import { useComingSoon } from "@/hooks/useComingSoon";
import userFallback from "@/assets/icons/User Circle.png";

export default function SettingsPage() {
  const navigate = useNavigate();
  const comingSoon = useComingSoon();
  const user = useAuthUser();
  const stored = getStoredAuthUser();
  const { data: bookings = [] } = useMyExpeditionBookings(1, undefined, 100);
  const { wishlist } = useWishlist();
  const { data: reviews = [] } = useMyReviews();

  const upcomingCount = bookings.filter((b) => ["PENDING", "CONFIRMED"].includes(b.status)).length;

  const [form, setForm] = useState({
    username: stored?.name || "",
    email: stored?.email || "",
    phone: "",
    about: "",
    showContact: false,
    homeAirport: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "",
    currentPassword: "",
    newPassword: "",
    newPasswordAgain: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const avatarSrc = user?.photoURL || stored?.photoURL || userFallback;

  return (
    <div className="w-full mx-auto space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-br from-[var(--bv-accent)] to-[var(--bv-forest)] rounded-2xl p-6 sm:p-8 text-white">
        <h2 className="text-[22px] sm:text-[26px] font-heading font-bold leading-tight">
          Welcome back, {user?.name?.split(" ")[0] || stored?.name?.split(" ")[0] || "there"}
        </h2>
        <p className="text-white/75 text-[14px] mt-1">Here's what's happening with your trips.</p>

        <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-5">
          <button
            onClick={() => navigate("/dashboard/bookings")}
            className="bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl p-3.5 sm:p-4 text-left transition-colors cursor-pointer"
          >
            <CalendarDays size={20} className="text-white/80 mb-2" />
            <p className="text-[22px] sm:text-[26px] font-bold font-heading leading-none">{upcomingCount}</p>
            <p className="text-[12px] sm:text-[13px] text-white/70 mt-1">Upcoming trips</p>
          </button>
          <button
            onClick={() => navigate("/dashboard/wishlist")}
            className="bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl p-3.5 sm:p-4 text-left transition-colors cursor-pointer"
          >
            <Heart size={20} className="text-white/80 mb-2" />
            <p className="text-[22px] sm:text-[26px] font-bold font-heading leading-none">{wishlist.length}</p>
            <p className="text-[12px] sm:text-[13px] text-white/70 mt-1">Wishlist items</p>
          </button>
          <button
            onClick={() => navigate("/dashboard/reviews")}
            className="bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl p-3.5 sm:p-4 text-left transition-colors cursor-pointer"
          >
            <Star size={20} className="text-white/80 mb-2" />
            <p className="text-[22px] sm:text-[26px] font-bold font-heading leading-none">{reviews.length}</p>
            <p className="text-[12px] sm:text-[13px] text-white/70 mt-1">Reviews</p>
          </button>
        </div>
      </div>

      {/* Profile header card */}
      <div className="bg-white rounded-2xl border border-[var(--bv-border)] p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <div className="relative group">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-[var(--bv-accent-soft)] ring-3 ring-[var(--bv-accent)]/15 shrink-0">
            <img
              src={avatarSrc}
              alt="Avatar"
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = userFallback }}
            />
          </div>
          <button
            className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer is-coming-soon"
            aria-label="Change avatar"
            {...comingSoon}
          >
            <Camera size={20} className="text-white" />
          </button>
        </div>
        <div className="text-center sm:text-left flex-1 min-w-0">
          <h2 className="text-[20px] font-heading font-bold text-[var(--bv-ink)] truncate">
            {user?.name || stored?.name || "User"}
          </h2>
          <p className="text-[14px] text-[var(--bv-muted)] truncate mt-0.5">
            {user?.email || stored?.email || ""}
          </p>
          <p className="text-[12px] text-[var(--bv-faint)] mt-1">Member since Jul 2026</p>
        </div>
      </div>

      {/* Personal Information */}
      <div className="bg-white rounded-2xl border border-[var(--bv-border)] overflow-hidden">
        <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-[var(--bv-border)] flex items-center gap-2.5">
          <User size={18} className="text-[var(--bv-accent)]" />
          <h3 className="text-[16px] font-heading font-semibold text-[var(--bv-ink)]">Personal Information</h3>
        </div>

        <div className="px-6 sm:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[var(--bv-text)]">Username</label>
              <Input
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="Username"
                className="rounded-xl border-[var(--bv-border-strong)] focus:border-[var(--bv-accent)] focus:ring-[var(--bv-accent)]/15 h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[var(--bv-text)]">Email</label>
              <Input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Email address"
                className="rounded-xl border-[var(--bv-border-strong)] focus:border-[var(--bv-accent)] focus:ring-[var(--bv-accent)]/15 h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[var(--bv-text)]">Phone Number</label>
              <Input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="Phone number"
                className="rounded-xl border-[var(--bv-border-strong)] focus:border-[var(--bv-accent)] focus:ring-[var(--bv-accent)]/15 h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2 lg:col-span-1">
              <label className="text-[13px] font-semibold text-[var(--bv-text)]">About Yourself</label>
              <textarea
                name="about"
                className="w-full min-h-[100px] p-3 border border-[var(--bv-border-strong)] rounded-xl text-[14px] text-[var(--bv-ink)] bg-white resize-y transition-all duration-150 focus:outline-none focus:border-[var(--bv-accent)] focus:ring-2 focus:ring-[var(--bv-accent)]/15 placeholder:text-[var(--bv-faint)] font-[var(--font-body)]"
                value={form.about}
                onChange={handleChange}
                placeholder="Write something about yourself..."
                rows={4}
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-[13px] text-[var(--bv-muted)] cursor-pointer mt-5">
            <input
              type="checkbox"
              name="showContact"
              checked={form.showContact}
              onChange={handleChange}
              className="appearance-none w-[18px] h-[18px] border-[1.5px] border-[var(--bv-border-strong)] rounded bg-white shrink-0 relative transition-all duration-150 checked:bg-[var(--bv-accent)] checked:border-[var(--bv-accent)] checked:after:content-[''] checked:after:absolute checked:after:left-[5px] checked:after:top-[2px] checked:after:w-[5px] checked:after:h-[9px] checked:after:border-white checked:after:border-r-2 checked:after:border-b-2 checked:after:rotate-45"
            />
            <span>Show email and phone number to other accounts</span>
          </label>
        </div>

        <div className="px-6 sm:px-8 py-4 border-t border-[var(--bv-border)] bg-[var(--bv-surface-2)]/50">
          <button
            className="px-6 py-2.5 bg-[var(--bv-accent)] text-white rounded-xl text-[14px] font-semibold hover:bg-[var(--bv-accent-strong)] transition-colors is-coming-soon"
            {...comingSoon}
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Location */}
      <div className="bg-white rounded-2xl border border-[var(--bv-border)] overflow-hidden">
        <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-[var(--bv-border)] flex items-center gap-2.5">
          <MapPin size={18} className="text-[var(--bv-accent)]" />
          <h3 className="text-[16px] font-heading font-semibold text-[var(--bv-ink)]">Location</h3>
        </div>

        <div className="px-6 sm:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[var(--bv-text)]">Home Airport</label>
              <Input
                name="homeAirport"
                value={form.homeAirport}
                onChange={handleChange}
                placeholder="Home airport"
                className="rounded-xl border-[var(--bv-border-strong)] focus:border-[var(--bv-accent)] focus:ring-[var(--bv-accent)]/15 h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[var(--bv-text)]">Address</label>
              <Input
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Street address"
                className="rounded-xl border-[var(--bv-border-strong)] focus:border-[var(--bv-accent)] focus:ring-[var(--bv-accent)]/15 h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[var(--bv-text)]">City</label>
              <Input
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="City"
                className="rounded-xl border-[var(--bv-border-strong)] focus:border-[var(--bv-accent)] focus:ring-[var(--bv-accent)]/15 h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[var(--bv-text)]">State / Province / Region</label>
              <Input
                name="state"
                value={form.state}
                onChange={handleChange}
                placeholder="State"
                className="rounded-xl border-[var(--bv-border-strong)] focus:border-[var(--bv-accent)] focus:ring-[var(--bv-accent)]/15 h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[var(--bv-text)]">ZIP / Postal Code</label>
              <Input
                name="zip"
                value={form.zip}
                onChange={handleChange}
                placeholder="ZIP code"
                className="rounded-xl border-[var(--bv-border-strong)] focus:border-[var(--bv-accent)] focus:ring-[var(--bv-accent)]/15 h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[var(--bv-text)]">Country</label>
              <Input
                name="country"
                value={form.country}
                onChange={handleChange}
                placeholder="Country"
                className="rounded-xl border-[var(--bv-border-strong)] focus:border-[var(--bv-accent)] focus:ring-[var(--bv-accent)]/15 h-11"
              />
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-4 border-t border-[var(--bv-border)] bg-[var(--bv-surface-2)]/50">
          <button
            className="px-6 py-2.5 bg-[var(--bv-accent)] text-white rounded-xl text-[14px] font-semibold hover:bg-[var(--bv-accent-strong)] transition-colors is-coming-soon"
            {...comingSoon}
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-2xl border border-[var(--bv-border)] overflow-hidden">
        <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-[var(--bv-border)] flex items-center gap-2.5">
          <Lock size={18} className="text-[var(--bv-accent)]" />
          <h3 className="text-[16px] font-heading font-semibold text-[var(--bv-ink)]">Change Password</h3>
        </div>

        <div className="px-6 sm:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[var(--bv-text)]">Current Password</label>
              <Input
                name="currentPassword"
                type="password"
                value={form.currentPassword}
                onChange={handleChange}
                placeholder="Current password"
                className="rounded-xl border-[var(--bv-border-strong)] focus:border-[var(--bv-accent)] focus:ring-[var(--bv-accent)]/15 h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[var(--bv-text)]">New Password</label>
              <Input
                name="newPassword"
                type="password"
                value={form.newPassword}
                onChange={handleChange}
                placeholder="New password"
                className="rounded-xl border-[var(--bv-border-strong)] focus:border-[var(--bv-accent)] focus:ring-[var(--bv-accent)]/15 h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[var(--bv-text)]">Confirm New Password</label>
              <Input
                name="newPasswordAgain"
                type="password"
                value={form.newPasswordAgain}
                onChange={handleChange}
                placeholder="Confirm new password"
                className="rounded-xl border-[var(--bv-border-strong)] focus:border-[var(--bv-accent)] focus:ring-[var(--bv-accent)]/15 h-11"
              />
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-4 border-t border-[var(--bv-border)] bg-[var(--bv-surface-2)]/50">
          <button
            className="px-6 py-2.5 bg-[var(--bv-accent)] text-white rounded-xl text-[14px] font-semibold hover:bg-[var(--bv-accent-strong)] transition-colors is-coming-soon"
            {...comingSoon}
          >
            Update Password
          </button>
        </div>
      </div>
    </div>
  );
}
