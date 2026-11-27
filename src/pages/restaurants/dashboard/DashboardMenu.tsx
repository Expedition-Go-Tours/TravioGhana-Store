import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  dashboardError,
  useDeleteVenueMenu,
  usePublishVenueMenu,
  useSaveVenueMenu,
  useUnpublishVenueMenu,
  useVenueMenus,
  type DashboardMenu as Menu,
  type MenuDocumentInput,
} from '../../../hooks/useRestaurantDashboard'
import {
  AddButton,
  DashboardPageHeader,
  EmptyState,
  ErrorBlock,
  InfoNote,
  LoadingBlock,
  SaveBar,
  StatusPill,
  formatMoney,
} from './components'

interface EditItem {
  name: string
  description: string
  price: string
  dietary: string[]
  isAvailable: boolean
}

interface EditSection {
  title: string
  description: string
  items: EditItem[]
}

type EditMenu = { id?: string; name: string; currency: string; description: string; sections: EditSection[] }

function blankItem(): EditItem {
  return {
    name: '',
    description: '',
    price: '',
    dietary: [],
    isAvailable: true,
  }
}

function fromMenu(menu?: Menu): EditMenu {
  if (!menu) {
    return {
      name: 'Main menu',
      currency: 'GHS',
      description: '',
      sections: [{ title: '', description: '', items: [blankItem()] }],
    }
  }
  return {
    id: menu.id,
    name: menu.name,
    currency: menu.currency,
    description: menu.description || '',
    sections: menu.sections.map((section) => ({
      title: section.title,
      description: section.description || '',
      items: section.items.map((item) => ({
        name: item.name,
        description: item.description || '',
        price: item.priceMinor == null ? '' : (item.priceMinor / 100).toFixed(2),
        dietary: item.dietary,
        isAvailable: item.isAvailable,
      })),
    })),
  }
}

function toInput(menu: EditMenu): MenuDocumentInput | null {
  if (!menu.name.trim()) return null
  if (menu.sections.length === 0 || menu.sections.some((section) => !section.title.trim())) return null

  const sections: MenuDocumentInput['sections'] = []
  for (const section of menu.sections) {
    const items: MenuDocumentInput['sections'][number]['items'] = []
    for (const item of section.items) {
      if (!item.name.trim()) continue
      const amount = item.price.trim()
      let priceMinor: number | null = null
      if (amount) {
        const value = Number(amount)
        if (!Number.isFinite(value) || value < 0) return null
        priceMinor = Math.round(value * 100)
      }
      items.push({
        name: item.name.trim(),
        description: item.description.trim() || null,
        priceMinor,
        dietary: item.dietary,
        isAvailable: item.isAvailable,
      })
    }
    sections.push({
      title: section.title.trim(),
      description: section.description.trim() || null,
      items,
    })
  }

  return {
    ...(menu.id ? { id: menu.id } : {}),
    name: menu.name.trim(),
    currency: menu.currency,
    description: menu.description.trim() || null,
    sections,
  }
}

function validMenu(menu: EditMenu): boolean {
  if (!menu.name.trim() || menu.sections.length === 0) return false
  if (menu.sections.some((section) => !section.title.trim())) return false
  return menu.sections.every((section) =>
    section.items.every((item) => {
      if (!item.name.trim()) return false
      if (!item.price.trim()) return true
      const value = Number(item.price)
      return Number.isFinite(value) && value >= 0
    }),
  )
}

function MenuEditor({
  slug,
  initial,
  onDone,
  published,
}: {
  slug: string
  initial: EditMenu
  onDone: () => void
  published: boolean
}) {
  const [draft, setDraft] = useState<EditMenu>(initial)
  const [saved, setSaved] = useState<EditMenu>(initial)
  const save = useSaveVenueMenu(slug)

  const patchSection = (index: number, change: Partial<EditSection>) =>
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section, i) => (i === index ? { ...section, ...change } : section)),
    }))

  const patchItem = (sectionIndex: number, itemIndex: number, change: Partial<EditItem>) =>
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section, i) =>
        i === sectionIndex
          ? {
              ...section,
              items: section.items.map((item, j) => (j === itemIndex ? { ...item, ...change } : item)),
            }
          : section,
      ),
    }))

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  return (
    <section className="rd-menu-editor">
      <div className="rd-field-grid">
        <label className="rd-field">
          Menu name
          <input value={draft.name} maxLength={80} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </label>
        <label className="rd-field">
          Currency
          <select value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })}>
            {['GHS', 'USD', 'EUR', 'GBP', 'NGN', 'ZAR'].map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="rd-field">
        Menu description <span>(optional)</span>
        <input
          value={draft.description}
          maxLength={400}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          placeholder="e.g. Served daily from 11am"
        />
      </label>

      {draft.sections.map((section, sectionIndex) => (
        <div className="rd-menu-section" key={sectionIndex}>
          <div className="rd-menu-section__head">
            <input
              aria-label={`Section ${sectionIndex + 1} title`}
              value={section.title}
              maxLength={80}
              placeholder="Section title, e.g. Starters"
              onChange={(event) => patchSection(sectionIndex, { title: event.target.value })}
            />
            <button
              type="button"
              className="rd-danger-link"
              aria-label={`Remove section ${sectionIndex + 1}`}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  sections: current.sections.filter((_, i) => i !== sectionIndex),
                }))
              }
            >
              <Trash2 size={15} />
            </button>
          </div>
          <input
            aria-label={`Section ${sectionIndex + 1} description`}
            className="rd-menu-section__desc"
            value={section.description}
            maxLength={400}
            placeholder="Description (optional)"
            onChange={(event) => patchSection(sectionIndex, { description: event.target.value })}
          />

          <div className="rd-menu-items">
            {section.items.map((item, itemIndex) => (
              <div className="rd-menu-item" key={itemIndex}>
                <input
                  aria-label={`Item ${itemIndex + 1} name`}
                  value={item.name}
                  maxLength={120}
                  placeholder="Dish name"
                  onChange={(event) => patchItem(sectionIndex, itemIndex, { name: event.target.value })}
                />
                <input
                  aria-label={`Item ${itemIndex + 1} price`}
                  className="rd-menu-item__price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.price}
                  placeholder="Market price"
                  onChange={(event) => patchItem(sectionIndex, itemIndex, { price: event.target.value })}
                />
                <input
                  aria-label={`Item ${itemIndex + 1} description`}
                  className="rd-menu-item__desc"
                  value={item.description}
                  maxLength={600}
                  placeholder="Description (optional)"
                  onChange={(event) => patchItem(sectionIndex, itemIndex, { description: event.target.value })}
                />
                <input
                  aria-label={`Item ${itemIndex + 1} dietary tags`}
                  className="rd-menu-item__dietary"
                  value={item.dietary.join(', ')}
                  placeholder="Dietary tags"
                  onChange={(event) =>
                    patchItem(sectionIndex, itemIndex, {
                      dietary: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean),
                    })
                  }
                />
                <label className="rd-menu-item__available">
                  <input
                    type="checkbox"
                    checked={item.isAvailable}
                    onChange={(event) => patchItem(sectionIndex, itemIndex, { isAvailable: event.target.checked })}
                  />
                  Available
                </label>
                <button
                  type="button"
                  className="rd-danger-link"
                  aria-label={`Remove item ${itemIndex + 1}`}
                  onClick={() =>
                    patchSection(sectionIndex, {
                      items: section.items.filter((_, j) => j !== itemIndex),
                    })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <AddButton
              label="Add dish"
              onClick={() =>
                patchSection(sectionIndex, { items: [...section.items, blankItem()] })
              }
            />
          </div>
        </div>
      ))}

      <AddButton
        label="Add section"
        onClick={() =>
          setDraft((current) => ({
            ...current,
            sections: [...current.sections, { title: '', description: '', items: [blankItem()] }],
          }))
        }
      />

      <p className="rd-menu-hint">
        Leave a price blank for market price. Prices are saved in {draft.currency} minor units so they
        stay exact. {published ? 'Saving republishes the menu immediately.' : ''}
      </p>

      <SaveBar
        dirty={dirty && validMenu(draft)}
        pending={save.isPending}
        onSave={() => {
          const input = toInput(draft)
          if (!input) {
            toast.error('Add a menu name, section title and dish before saving.')
            return
          }
          save.mutate(input, {
            onSuccess: () => {
              setSaved(draft)
              toast.success('Menu saved.')
            },
            onError: (error) => toast.error(dashboardError(error)),
          })
        }}
      />
      <button type="button" className="rd-quiet-link" onClick={onDone}>Close editor</button>
    </section>
  )
}

export default function DashboardMenu() {
  const { slug = '' } = useParams<{ slug: string }>()
  const menus = useVenueMenus(slug)
  const save = useSaveVenueMenu(slug)
  const publish = usePublishVenueMenu(slug)
  const unpublish = useUnpublishVenueMenu(slug)
  const remove = useDeleteVenueMenu(slug)
  const [editing, setEditing] = useState<Menu | 'new' | null>(null)

  return (
    <>
      <DashboardPageHeader
        eyebrow="Menu"
        title="Menu"
        description="Build a structured menu diners can read on your listing."
        actions={
          <button
            type="button"
            className="rd-button rd-button--primary"
            onClick={() => {
              save.reset()
              setEditing('new')
            }}
          >
            <Plus size={15} /> New menu
          </button>
        }
      />
      <InfoNote>
        Published menus appear on your public listing. The menu link you saved under Business info
        stays as a fallback.
      </InfoNote>

      {menus.isPending ? (
        <LoadingBlock label="Loading menus…" />
      ) : menus.isError ? (
        <ErrorBlock message={dashboardError(menus.error)} onRetry={() => void menus.refetch()} />
      ) : (
        <>
          {editing && (
            <section className="rd-section" aria-label="Menu editor">
              <div className="rd-section__head">
                <h2>{editing === 'new' ? 'New menu' : `Edit ${editing.name}`}</h2>
                {editing !== 'new' && <StatusPill status={editing.status} />}
              </div>
              <MenuEditor
                slug={slug}
                initial={fromMenu(editing === 'new' ? undefined : editing)}
                published={editing !== 'new' && editing.status === 'PUBLISHED'}
                onDone={() => setEditing(null)}
              />
            </section>
          )}

          {menus.data.menus.length === 0 && !editing ? (
            <EmptyState
              title="No menu yet"
              description="Add sections and dishes, then publish when everything looks right."
              action={
                <button type="button" className="rd-button rd-button--secondary" onClick={() => setEditing('new')}>
                  Create a menu
                </button>
              }
            />
          ) : (
            <div className="rd-menu-list">
              {menus.data.menus.map((menu) => (
                <article key={menu.id} className="rd-menu-card">
                  <div className="rd-menu-card__head">
                    <div>
                      <h2>{menu.name}</h2>
                      <p>{menu.description || 'No description'}</p>
                    </div>
                    <StatusPill status={menu.status} />
                  </div>
                  <div className="rd-menu-card__preview">
                    {menu.sections.slice(0, 3).map((section) => (
                      <div key={section.id}>
                        <strong>{section.title}</strong>
                        <span>
                          {section.items.slice(0, 3).map((item) => item.name).join(' · ') || 'No dishes'}
                        </span>
                      </div>
                    ))}
                    {menu.sections.length === 0 && <span>No sections yet</span>}
                  </div>
                  <div className="rd-menu-card__foot">
                    <span>
                      {menu.sections.length} section{menu.sections.length === 1 ? '' : 's'} ·{' '}
                      {menu.sections.reduce((sum, section) => sum + section.items.length, 0)} dishes ·{' '}
                      {formatMoney(
                        menu.sections.flatMap((section) => section.items).find((item) => item.priceMinor != null)?.priceMinor ?? null,
                        menu.currency,
                      )}
                      {' and up'}
                    </span>
                    <div className="rd-menu-card__actions">
                      <button type="button" onClick={() => setEditing(menu)}>Edit</button>
                      {menu.status === 'PUBLISHED' ? (
                        <button
                          type="button"
                          onClick={() =>
                            unpublish.mutate(menu.id, {
                              onSuccess: () => toast.success('Menu unpublished.'),
                              onError: (error) => toast.error(dashboardError(error)),
                            })
                          }
                        >
                          Unpublish
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            publish.mutate(menu.id, {
                              onSuccess: () => toast.success('Menu published.'),
                              onError: (error) => toast.error(dashboardError(error)),
                            })
                          }
                        >
                          Publish
                        </button>
                      )}
                      <button
                        type="button"
                        className="rd-danger-link"
                        onClick={() => {
                          if (window.confirm(`Delete “${menu.name}”? This cannot be undone.`)) {
                            remove.mutate(menu.id, {
                              onSuccess: () => toast.success('Menu deleted.'),
                              onError: (error) => toast.error(dashboardError(error)),
                            })
                          }
                        }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {menus.data.menuUrl && (
            <p className="rd-menu-fallback">
              Fallback menu link: <a href={menus.data.menuUrl} target="_blank" rel="noreferrer">{menus.data.menuUrl}</a>
            </p>
          )}
        </>
      )}
    </>
  )
}
