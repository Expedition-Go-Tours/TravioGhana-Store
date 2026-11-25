import Footer from '../../components/Footer'
import '../RestaurantsPage.css'
import './RestaurantPages.css'
import './RestaurantDetailPage.css'

/**
 * Detail-page skeleton. It mirrors the real layout — breadcrumb, header,
 * gallery, section tabs, overview column and sticky rail — so the page does
 * not jump when the venue arrives. Each block shimmers independently; there is
 * deliberately no single full-page grey panel.
 */
export default function RestaurantDetailSkeleton() {
  return (
    <div className="restaurants-page">
      <main
        className="restaurants-page__main rvd-page rvd-skeleton"
        aria-busy="true"
        aria-label="Loading restaurant"
      >
        <span className="rvd-sr-only">Loading restaurant details…</span>

        <div className="rh-breadcrumb rvd-skel-breadcrumb" aria-hidden="true">
          <span className="rvd-skel-block rvd-skel-w-40px" />
          <span className="rvd-skel-chevron" />
          <span className="rvd-skel-block rvd-skel-w-70px" />
          <span className="rvd-skel-chevron" />
          <span className="rvd-skel-block rvd-skel-w-100px" />
        </div>

        <header className="rvd-header rvd-skel-header" aria-hidden="true">
          <div className="rvd-header__main">
            <div className="rvd-badges">
              <span className="rvd-skel-block rvd-skel-pill" />
              <span className="rvd-skel-block rvd-skel-pill rvd-skel-pill--short" />
            </div>
            <span className="rvd-skel-block rvd-skel-title" />
            <div className="rvd-header__meta">
              <span className="rvd-skel-block rvd-skel-chip" />
              <span className="rvd-skel-block rvd-skel-chip rvd-skel-chip--short" />
              <span className="rvd-skel-block rvd-skel-chip rvd-skel-chip--medium" />
            </div>
            <div className="rvd-skel-meta-row">
              <span className="rvd-skel-block rvd-skel-line rvd-skel-w-28" />
              <span className="rvd-skel-block rvd-skel-line rvd-skel-w-18" />
              <span className="rvd-skel-block rvd-skel-line rvd-skel-w-22" />
            </div>
          </div>
          <div className="rvd-header__actions rvd-skel-actions">
            <span className="rvd-skel-block rvd-skel-button" />
            <span className="rvd-skel-block rvd-skel-button rvd-skel-button--quiet" />
            <span className="rvd-skel-block rvd-skel-button rvd-skel-button--quiet" />
          </div>
        </header>

        <section className="rd-gallery rd-gallery--single rvd-skel-gallery" aria-hidden="true">
          <div className="rvd-skel-gallery__main" />
          <div className="rvd-skel-gallery__side">
            <span className="rvd-skel-block rvd-skel-circle" />
            <span className="rvd-skel-block rvd-skel-line rvd-skel-w-60" />
            <span className="rvd-skel-block rvd-skel-line rvd-skel-w-92" />
            <span className="rvd-skel-block rvd-skel-line rvd-skel-w-78" />
            <span className="rvd-skel-block rvd-skel-button rvd-skel-button--light" />
          </div>
        </section>

        <div className="rvd-anchor-nav rvd-skel-tabs" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} className="rvd-skel-block rvd-skel-tab" />
          ))}
        </div>

        <div className="rvd-layout rvd-skel-layout">
          <div className="rvd-main-column">
            <section className="rvd-section rvd-skel-panel" aria-hidden="true">
              <span className="rvd-skel-block rvd-skel-heading" />
              <span className="rvd-skel-block rvd-skel-line rvd-skel-w-30" />
              <span className="rvd-skel-block rvd-skel-line rvd-skel-w-74" />
              <span className="rvd-skel-block rvd-skel-line rvd-skel-w-64" />
              <div className="rvd-skel-chip-row">
                <span className="rvd-skel-block rvd-skel-chip" />
                <span className="rvd-skel-block rvd-skel-chip rvd-skel-chip--short" />
                <span className="rvd-skel-block rvd-skel-chip rvd-skel-chip--medium" />
              </div>
            </section>

            <section className="rvd-section rvd-skel-panel" aria-hidden="true">
              <span className="rvd-skel-block rvd-skel-heading rvd-skel-heading--medium" />
              <span className="rvd-skel-block rvd-skel-line rvd-skel-w-88" />
              <span className="rvd-skel-block rvd-skel-line rvd-skel-w-96" />
              <span className="rvd-skel-block rvd-skel-line rvd-skel-w-72" />
            </section>

            <section className="rvd-section rvd-skel-panel" aria-hidden="true">
              <span className="rvd-skel-block rvd-skel-heading rvd-skel-heading--medium" />
              <div className="rvd-skel-review">
                <span className="rvd-skel-block rvd-skel-score" />
                <div className="rvd-skel-review__copy">
                  <span className="rvd-skel-block rvd-skel-line rvd-skel-w-40" />
                  <span className="rvd-skel-block rvd-skel-line rvd-skel-w-84" />
                  <span className="rvd-skel-block rvd-skel-line rvd-skel-w-66" />
                </div>
              </div>
              <div className="rvd-skel-review">
                <span className="rvd-skel-block rvd-skel-avatar" />
                <div className="rvd-skel-review__copy">
                  <span className="rvd-skel-block rvd-skel-line rvd-skel-w-52" />
                  <span className="rvd-skel-block rvd-skel-line rvd-skel-w-92" />
                  <span className="rvd-skel-block rvd-skel-line rvd-skel-w-78" />
                </div>
              </div>
            </section>
          </div>

          <aside className="rvd-sidebar rvd-skel-aside" aria-hidden="true">
            <section className="rvd-side-card">
              <span className="rvd-skel-block rvd-skel-heading rvd-skel-heading--small" />
              <span className="rvd-skel-block rvd-skel-line rvd-skel-w-90" />
              <span className="rvd-skel-block rvd-skel-line rvd-skel-w-70" />
              <span className="rvd-skel-block rvd-skel-button rvd-skel-button--wide" />
            </section>
            <section className="rvd-side-card">
              <span className="rvd-skel-block rvd-skel-heading rvd-skel-heading--small" />
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="rvd-skel-hours-row">
                  <span className="rvd-skel-block rvd-skel-line rvd-skel-w-20" />
                  <span className="rvd-skel-block rvd-skel-line rvd-skel-w-28" />
                </div>
              ))}
            </section>
            <section className="rvd-side-card">
              <span className="rvd-skel-block rvd-skel-heading rvd-skel-heading--small" />
              <span className="rvd-skel-block rvd-skel-line rvd-skel-w-86" />
              <span className="rvd-skel-block rvd-skel-line rvd-skel-w-64" />
            </section>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  )
}
