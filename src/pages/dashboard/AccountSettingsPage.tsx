import { useState } from 'react'
import { User, CreditCard } from 'lucide-react'
import PersonalDetailsTab from '../../features/account/PersonalDetailsTab'
import SavedCardsTab from '../../features/account/SavedCardsTab'
import './AccountSettingsPage.css'

type Tab = 'personal' | 'cards'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'personal', label: 'Personal details', icon: <User size={18} /> },
  { key: 'cards', label: 'Saved cards', icon: <CreditCard size={18} /> },
]

export default function AccountSettingsPage() {
  const [active, setActive] = useState<Tab>('personal')

  return (
    <div className="account-settings">
      <nav className="account-settings__nav" aria-label="Account settings">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`account-settings__nav-item${active === t.key ? ' active' : ''}`}
            onClick={() => setActive(t.key)}
            aria-current={active === t.key ? 'page' : undefined}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <section className="account-settings__content">
        {active === 'personal' && <PersonalDetailsTab />}
        {active === 'cards' && <SavedCardsTab />}
      </section>
    </div>
  )
}
