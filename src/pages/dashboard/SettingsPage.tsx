import { useState } from "react";
import { toast } from "sonner";
import { getStoredAuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import userSrc from "@/assets/icons/User Circle.png";

export default function SettingsPage() {
  const user = getStoredAuthUser();

  const [form, setForm] = useState({
    username: user?.name || "",
    email: user?.email || "",
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

  const handleSave = () => {
    toast.success("Account settings saved");
  };

  const handleChangePassword = () => {
    if (form.newPassword !== form.newPasswordAgain) {
      toast.error("Passwords do not match");
      return;
    }
    if (!form.currentPassword || !form.newPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    toast.success("Password changed successfully");
    setForm((prev) => ({
      ...prev,
      currentPassword: "",
      newPassword: "",
      newPasswordAgain: "",
    }));
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <section className="bg-white rounded-xl border border-[#e5e4e7] p-8 mb-7">
        <h2 className="text-[13px] font-bold tracking-[1.5px] text-[#6b7280] uppercase mb-6 pb-4 border-b border-[#e5e4e7]">
          PERSONAL INFORMATION
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-bold text-[#1a1a1a]">Username</label>
              <Input name="username" value={form.username} onChange={handleChange} placeholder="Username" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-bold text-[#1a1a1a]">E-mail</label>
              <Input name="email" type="email" value={form.email} onChange={handleChange} placeholder="E-mail" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-bold text-[#1a1a1a]">Phone Number</label>
              <Input name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="Phone Number" />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-bold text-[#1a1a1a]">About Yourself</label>
              <textarea
                name="about"
                className="w-full min-h-[120px] p-2.5 border border-[#e5e4e7] rounded-lg text-[14px] text-[#1a1a1a] bg-white resize-y transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-[#065f46] focus:shadow-[0_0_0_3px_rgba(6,95,70,0.15)] placeholder:text-[#9ca3af]"
                value={form.about}
                onChange={handleChange}
                placeholder="Write something about yourself..."
                rows={5}
              />
            </div>
            <label className="flex items-center gap-2.5 text-[13px] text-[#6b7280] cursor-pointer mt-1">
              <input
                type="checkbox"
                name="showContact"
                checked={form.showContact}
                onChange={handleChange}
                className="appearance-none w-[18px] h-[18px] border-[1.5px] border-[#d1d5db] rounded bg-white shrink-0 relative transition-all duration-150 checked:bg-[#065f46] checked:border-[#065f46] checked:after:content-[''] checked:after:absolute checked:after:left-[5px] checked:after:top-[2px] checked:after:w-[5px] checked:after:h-[9px] checked:after:border-white checked:after:border-r-2 checked:after:border-b-2 checked:after:rotate-45"
              />
              <span>Show email and phone number to other accounts</span>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-5 mt-6 pt-5 border-t border-[#e5e4e7]">
          <div className="w-[72px] h-[72px] rounded-full overflow-hidden bg-[#e5e7eb] shrink-0">
            <img
              src={user?.photoURL || userSrc}
              alt="Avatar"
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = userSrc }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-[#6b7280]">Change Avatar / JPG or PNG</span>
            <Button size="sm" className="bg-[#065f46] text-white hover:bg-[#047857] w-fit">
              Avatar
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-[#e5e4e7] p-8 mb-7">
        <h2 className="text-[13px] font-bold tracking-[1.5px] text-[#6b7280] uppercase mb-6 pb-4 border-b border-[#e5e4e7]">
          LOCATION
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-bold text-[#1a1a1a]">Home Airport</label>
            <Input name="homeAirport" value={form.homeAirport} onChange={handleChange} placeholder="Home Airport" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-bold text-[#1a1a1a]">Address</label>
            <Input name="address" value={form.address} onChange={handleChange} placeholder="Address" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-bold text-[#1a1a1a]">City</label>
            <Input name="city" value={form.city} onChange={handleChange} placeholder="City" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-bold text-[#1a1a1a]">State/Province/Region</label>
            <Input name="state" value={form.state} onChange={handleChange} placeholder="State/Province/Region" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-bold text-[#1a1a1a]">ZIP code/Postal code</label>
            <Input name="zip" value={form.zip} onChange={handleChange} placeholder="ZIP code/Postal code" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-bold text-[#1a1a1a]">Country</label>
            <Input name="country" value={form.country} onChange={handleChange} placeholder="Country" />
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-[#e5e4e7]">
          <Button onClick={handleSave} className="bg-[#065f46] text-white hover:bg-[#047857]">
            SAVE CHANGES
          </Button>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-[#e5e4e7] p-8">
        <h2 className="text-[13px] font-bold tracking-[1.5px] text-[#6b7280] uppercase mb-6 pb-4 border-b border-[#e5e4e7]">
          CHANGE PASSWORD
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-bold text-[#1a1a1a]">Current Password</label>
            <Input name="currentPassword" type="password" value={form.currentPassword} onChange={handleChange} placeholder="Current Password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-bold text-[#1a1a1a]">New Password</label>
            <Input name="newPassword" type="password" value={form.newPassword} onChange={handleChange} placeholder="New Password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-bold text-[#1a1a1a]">New Password Again</label>
            <Input name="newPasswordAgain" type="password" value={form.newPasswordAgain} onChange={handleChange} placeholder="New Password Again" />
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-[#e5e4e7]">
          <Button onClick={handleChangePassword} className="bg-[#065f46] text-white hover:bg-[#047857]">
            CHANGE PASSWORD
          </Button>
        </div>
      </section>
    </div>
  );
}
