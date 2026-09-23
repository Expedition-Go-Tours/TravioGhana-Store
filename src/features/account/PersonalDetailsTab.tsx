import { useState, useRef, useEffect, type FormEvent } from 'react'
import { User, MapPin, Lock, Camera, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthUser } from '../../hooks/useAuthUser'
import { getStoredAuthUser, updateStoredAuthUser } from '../../lib/auth'
import { SelectInput, TextInput } from '../../components/booking/FormFields'
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, buildE164Phone, splitE164Phone } from '../../lib/phone'
import {
  getAccount,
  updateAccount,
  changePassword,
} from './api'
import userFallback from '../../assets/icons/User Circle.png'

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const YEARS = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i)

function splitName(full: string): { first: string; last: string } {
  const parts = (full || '').trim().split(/\s+/)
  return { first: parts[0] || '', last: parts.slice(1).join(' ') }
}

export default function PersonalDetailsTab() {
  const user = useAuthUser()
  const stored = getStoredAuthUser()
  const fileRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  // Profile fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE)
  const [phone, setPhone] = useState('')
  const [dobDay, setDobDay] = useState('')
  const [dobMonth, setDobMonth] = useState('')
  const [dobYear, setDobYear] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [country, setCountry] = useState('')
  const [homeAirport, setHomeAirport] = useState('')

  // Password
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  // Delete account
  const [showDelete, setShowDelete] = useState(false)

  // Load profile from API
  useEffect(() => {
    let cancelled = false
    getAccount()
      .then((p) => {
        if (cancelled) return
        const { first, last } = splitName(p.name || '')
        setFirstName(first)
        setLastName(last)
        setEmail(p.email || '')
        const split = splitE164Phone(p.phone || '')
        if (split) {
          setCountryCode(split.countryCode)
          setPhone(split.nationalNumber)
        } else {
          setPhone(p.phone || '')
        }
        setAddress(p.address || '')
        setCity(p.city || '')
        setState(p.state || '')
        setZipCode(p.zipCode || '')
        setCountry(p.country || '')
        setHomeAirport(p.homeAirport || '')

        if (p.dateOfBirth) {
          const d = new Date(p.dateOfBirth)
          setDobDay(String(d.getDate()))
          setDobMonth(String(d.getMonth()))
          setDobYear(String(d.getFullYear()))
        }
      })
      .catch(() => {
        // Fallback to stored user
        const { first, last } = splitName(stored?.name || user?.name || '')
        setFirstName(first)
        setLastName(last)
        setEmail(stored?.email || user?.email || '')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const markDirty = () => { if (!dirty) setDirty(true) }

  // Avatar
  const onAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    markDirty()
  }

  // Save profile
  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return

    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
    if (!name.trim()) {
      toast.error('First name is required')
      return
    }

    // Combine the two-part phone input into a canonical E.164 value. Block the
    // save on an unparseable number instead of silently dropping it.
    let phoneValue: string | null = null
    if (phone.trim()) {
      const e164 = buildE164Phone(countryCode, phone)
      if (!e164) {
        toast.error('Enter a valid phone number for the selected country')
        return
      }
      phoneValue = e164
    }

    setSaving(true)
    try {
      const data: Record<string, unknown> = { name, phone: phoneValue }

      // DOB
      if (dobDay && dobMonth && dobYear) {
        data.dateOfBirth = new Date(Number(dobYear), Number(dobMonth), Number(dobDay)).toISOString()
      } else {
        data.dateOfBirth = null
      }

      data.address = address || null
      data.city = city || null
      data.state = state || null
      data.zipCode = zipCode || null
      data.country = country || null
      data.homeAirport = homeAirport || null

      const updated = await updateAccount(data, avatarFile)

      // Sync local auth state
      updateStoredAuthUser({
        name: updated.name,
        photoURL: updated.photoURL,
      })

      setDirty(false)
      setAvatarFile(null)
      toast.success('Profile saved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  // Password
  const handlePasswordChange = async () => {
    if (!currentPw || !newPw) {
      toast.error('Please fill in all password fields')
      return
    }
    if (newPw.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (newPw !== confirmPw) {
      toast.error('Passwords do not match')
      return
    }
    setPwSaving(true)
    try {
      await changePassword(currentPw, newPw)
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      toast.success('Password updated')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not update password')
    } finally {
      setPwSaving(false)
    }
  }

  // Delete account (confirmation only — no actual delete wired yet)
  const handleDeleteAccount = () => {
    setShowDelete(false)
    toast.info('Account deletion is not yet implemented. Contact support.')
  }

  const avatarSrc = avatarPreview || user?.photoURL || stored?.photoURL || userFallback

  if (loading) {
    return (
      <>
        <div className="account-section"><div className="account-section__body">
          <div className="skeleton-row" style={{ marginBottom: 12 }} />
          <div className="skeleton-row" style={{ marginBottom: 12 }} />
          <div className="skeleton-row" />
        </div></div>
        <div className="account-section"><div className="account-section__body">
          <div className="skeleton-row" />
        </div></div>
      </>
    )
  }

  return (
    <form onSubmit={handleSave}>
      {/* ── Avatar + Name ────────────────────────────────────────────── */}
      <div className="account-section">
        <div className="account-section__header">
          <User size={16} className="text-[var(--bv-accent)]" />
          <h3>Personal Information</h3>
        </div>

        <div className="account-section__body">
          {/* Avatar */}
          <div className="account-profile-head">
            <div className="account-avatar-wrap" onClick={() => fileRef.current?.click()}>
              <img
                src={avatarSrc}
                alt="Avatar"
                onError={(e) => { (e.target as HTMLImageElement).src = userFallback }}
              />
              <div className="account-avatar-overlay">
                <Camera size={16} />
              </div>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--bv-ink, #101828)', margin: 0 }}>
                {user?.name || stored?.name || 'User'}
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{ fontSize: 13, color: 'var(--bv-accent, #16a34a)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4, fontWeight: 600 }}
              >
                Change photo
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onAvatarPick}
            />
          </div>

          {/* Name */}
          <div className="account-form-row">
            <div className="account-field">
              <label htmlFor="acc-first">First name</label>
              <input
                id="acc-first"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); markDirty() }}
                placeholder="First name"
              />
            </div>
            <div className="account-field">
              <label htmlFor="acc-last">Last name</label>
              <input
                id="acc-last"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); markDirty() }}
                placeholder="Last name"
              />
            </div>
          </div>

          {/* Email */}
          <div className="account-form-row account-form-row--single">
            <div className="account-field">
              <label htmlFor="acc-email">Email</label>
              <input id="acc-email" value={email} readOnly />
            </div>
          </div>

          {/* Phone */}
          <div className="account-form-row account-form-row--single">
            <div className="account-field">
              <label htmlFor="acc-phone">Mobile phone</label>
              <div className="account-phone-grid grid gap-3 sm:grid-cols-[1.2fr_2fr]">
                <SelectInput
                  value={countryCode}
                  onChange={(e) => { setCountryCode(e.target.value); markDirty() }}
                  options={COUNTRY_CODES}
                />
                <TextInput
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); markDirty() }}
                  placeholder="e.g. 024 123 4567"
                />
              </div>
            </div>
          </div>

          {/* DOB */}
          <div className="account-form-row account-form-row--single">
            <div className="account-field">
              <label>Date of birth</label>
              <div className="dob-selects">
                <select value={dobDay} onChange={(e) => { setDobDay(e.target.value); markDirty() }}>
                  <option value="">Day</option>
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={dobMonth} onChange={(e) => { setDobMonth(e.target.value); markDirty() }}>
                  <option value="">Month</option>
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <select value={dobYear} onChange={(e) => { setDobYear(e.target.value); markDirty() }}>
                  <option value="">Year</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="account-section__footer">
          <button type="submit" className="account-btn account-btn--primary" disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Location ─────────────────────────────────────────────────── */}
      <div className="account-section">
        <div className="account-section__header">
          <MapPin size={16} className="text-[var(--bv-accent)]" />
          <h3>Location</h3>
        </div>

        <div className="account-section__body">
          <div className="account-form-row account-form-row--single">
            <div className="account-field">
              <label htmlFor="acc-airport">Home airport</label>
              <input
                id="acc-airport"
                value={homeAirport}
                onChange={(e) => { setHomeAirport(e.target.value); markDirty() }}
                placeholder="e.g. ACC — Kotoka International"
              />
            </div>
          </div>

          <div className="account-form-row">
            <div className="account-field">
              <label htmlFor="acc-address">Address</label>
              <input
                id="acc-address"
                value={address}
                onChange={(e) => { setAddress(e.target.value); markDirty() }}
                placeholder="Street address"
              />
            </div>
            <div className="account-field">
              <label htmlFor="acc-city">City</label>
              <input
                id="acc-city"
                value={city}
                onChange={(e) => { setCity(e.target.value); markDirty() }}
                placeholder="City"
              />
            </div>
          </div>

          <div className="account-form-row account-form-row--triple">
            <div className="account-field">
              <label htmlFor="acc-state">State / Province</label>
              <input
                id="acc-state"
                value={state}
                onChange={(e) => { setState(e.target.value); markDirty() }}
                placeholder="State"
              />
            </div>
            <div className="account-field">
              <label htmlFor="acc-zip">ZIP / Postal code</label>
              <input
                id="acc-zip"
                value={zipCode}
                onChange={(e) => { setZipCode(e.target.value); markDirty() }}
                placeholder="ZIP code"
              />
            </div>
            <div className="account-field">
              <label htmlFor="acc-country">Country</label>
              <input
                id="acc-country"
                value={country}
                onChange={(e) => { setCountry(e.target.value); markDirty() }}
                placeholder="Country"
              />
            </div>
          </div>
        </div>

        <div className="account-section__footer">
          <button type="submit" className="account-btn account-btn--primary" disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Password ─────────────────────────────────────────────────── */}
      <div className="account-section">
        <div className="account-section__header">
          <Lock size={16} className="text-[var(--bv-accent)]" />
          <h3>Change Password</h3>
        </div>

        <div className="account-section__body">
          <div className="account-form-row account-form-row--single">
            <div className="account-field">
              <label htmlFor="acc-cur-pw">Current password</label>
              <input
                id="acc-cur-pw"
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Current password"
                autoComplete="current-password"
              />
            </div>
          </div>
          <div className="account-form-row">
            <div className="account-field">
              <label htmlFor="acc-new-pw">New password</label>
              <input
                id="acc-new-pw"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="New password (min 8 chars)"
                autoComplete="new-password"
              />
            </div>
            <div className="account-field">
              <label htmlFor="acc-confirm-pw">Confirm new password</label>
              <input
                id="acc-confirm-pw"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
            </div>
          </div>
        </div>

        <div className="account-section__footer">
          <button
            type="button"
            className="account-btn account-btn--primary"
            disabled={pwSaving || !currentPw || !newPw}
            onClick={handlePasswordChange}
          >
            {pwSaving ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </div>

      {/* ── Delete Account ───────────────────────────────────────────── */}
      <div className="account-section">
        <div className="account-section__header">
          <Trash2 size={16} className="text-red-500" />
          <h3>Delete Account</h3>
        </div>
        <div className="account-section__body account-danger-row">
          <p style={{ fontSize: 13, color: 'var(--bv-muted, #667085)', margin: 0 }}>
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <button type="button" className="account-btn account-btn--danger-text" onClick={() => setShowDelete(true)}>
            Delete account
          </button>
        </div>
      </div>

      {/* ── Delete confirmation modal ─────────────────────────────────── */}
      {showDelete && (
        <div className="account-modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="account-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="account-modal__header">
              <h3>Delete your account?</h3>
              <button className="account-modal__close" onClick={() => setShowDelete(false)}>✕</button>
            </div>
            <div className="account-modal__body">
              <p style={{ fontSize: 14, color: 'var(--bv-muted, #667085)', margin: 0 }}>
                This will permanently remove your profile, bookings, reviews, and saved cards. You cannot undo this.
              </p>
            </div>
            <div className="account-modal__footer">
              <button className="account-btn" style={{ background: 'var(--bv-surface-2, #f2f4f7)', color: 'var(--bv-ink)' }} onClick={() => setShowDelete(false)}>
                Cancel
              </button>
              <button className="account-btn" style={{ background: '#dc2626', color: '#fff' }} onClick={handleDeleteAccount}>
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
