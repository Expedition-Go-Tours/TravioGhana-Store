import { useState } from 'react'
import { User, CreditCard } from 'lucide-react'
import PersonalDetailsTab from '../../features/account/PersonalDetailsTab'
import SavedCardsTab from '../../features/account/SavedCardsTab'
import './AccountSettingsPage.css'

type Tab = 'personal' | 'cards'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'personal', label: 'Personal details', icon: <User size={22} /> },
  { key: 'cards', label: 'Saved cards', icon: <CreditCard size={22} /> },
]

/**
 * Account settings page — layout mirrors travio-ghana-account-settings-v2.html
 * (hero + pill tabs + panel). The template's own topbar is the navbar, which
 * the dashboard already provides, so only the page body is ported here.
 */
export default function AccountSettingsPage() {
  const [active, setActive] = useState<Tab>('personal')

  return (
    <div className="account-settings">
      <section className="account-settings__hero">
        <div className="account-settings__art" aria-hidden="true" />

        <div className="account-settings__eyebrow">ACCOUNT</div>
        <h1 className="account-settings__title">Account Settings</h1>
        <p className="account-settings__subtitle">
          Manage your profile, payment methods and preferences.
        </p>

        <div className="account-settings__tabs" role="tablist" aria-label="Account settings">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              className={`account-settings__tab${active === t.key ? ' active' : ''}`}
              aria-selected={active === t.key}
              aria-controls={`settings-panel-${t.key}`}
              onClick={() => setActive(t.key)}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </section>

      <div id={`settings-panel-${active}`} role="tabpanel">
        {active === 'personal' ? <PersonalDetailsTab /> : <SavedCardsTab />}
      </div>
    </div>
  )
}
