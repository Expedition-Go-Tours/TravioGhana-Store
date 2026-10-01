/* ============================================================================
   Transport Providers — /transport-providers
   ----------------------------------------------------------------------------
   Port of Travio_Ghana_Transport_Partners_Mobile_Alternating_Steps.html.

   The template was a standalone document: its .nav-shell/.nav-links and
   .footer are dropped (this route renders the app's global Navbar and
   Footer), its html/body/:root resets live on the .tp-page wrapper, and its
   four script behaviours are reimplemented as the effects below. See
   src/styles/TransportProviders.css for the CSS notes.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react'
import Footer from '../components/Footer'
import SEO from '../components/SEO'
import '../styles/partner-pages.css'
import '../styles/TransportProviders.css'

const CONTACT = 'https://www.travioghana.com/contact-us'

/** The template's illustrated map, with its SMIL vehicle animations. */
function GhanaMap({ svgRef }: { svgRef: React.RefObject<SVGSVGElement | null> }) {
  return (
    <svg ref={svgRef} className="ghana-map" viewBox="0 0 500 600" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
    <linearGradient id="land" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e1f4a7" /><stop offset=".54" stopColor="#9fce79" /><stop offset="1" stopColor="#51956a" /></linearGradient>
    <linearGradient id="carBody" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#fffde8" /><stop offset=".5" stopColor="#d7f29e" /><stop offset="1" stopColor="#6caa79" /></linearGradient>
    <filter id="mapShadow" x="-50%" y="-50%" width="200%" height="230%"><feDropShadow dx="9" dy="20" stdDeviation="13" floodColor="#00190f" floodOpacity=".6" /></filter>
    <path id="ghanaShape" d="M130 56 L166 59 193 53 220 57 250 52 283 62 310 54 348 62 371 71 383 104 374 129 394 158 386 185 399 217 382 240 390 276 373 299 376 331 358 351 375 378 364 405 374 431 350 458 335 480 306 500 272 511 241 518 212 526 180 530 150 523 123 518 102 501 79 493 69 469 80 442 77 410 92 386 88 351 104 327 94 300 108 272 104 245 112 220 102 188 106 165 94 137 108 113 102 88 118 73 Z" />
    <clipPath id="ghanaClip"><use href="#ghanaShape" /></clipPath>
    <g id="mapCar" transform="rotate(90)"><ellipse cx="0" cy="8" rx="17" ry="24" fill="#163226" opacity=".32" /><rect x="-14" y="-23" width="28" height="47" rx="10" fill="url(#carBody)" stroke="#f8fff0" strokeWidth="2" /><path d="M-10-9 Q0-17 10-9 L10 7 Q0 13-10 7Z" fill="#265c4c" /><path d="M-10 13H10" stroke="#517b58" strokeWidth="3" /><path d="M-10-19h5m10 0h5" stroke="#fff7bf" strokeWidth="3" strokeLinecap="round" /></g>
    </defs>
    <path d="M32 546 Q218 596 463 526" fill="none" stroke="#ffffff20" strokeWidth="1" /><circle cx="82" cy="129" r="128" fill="none" stroke="#ffffff13" /><circle cx="420" cy="458" r="159" fill="none" stroke="#ffffff13" />
    <g className="map-object"><use href="#ghanaShape" transform="translate(0 15)" fill="#23583d" filter="url(#mapShadow)" /><use href="#ghanaShape" transform="translate(0 8)" fill="#427e50" /><use href="#ghanaShape" fill="url(#land)" stroke="#e2f7b8" strokeWidth="2" />
    <g clipPath="url(#ghanaClip)" opacity=".3" fill="none" stroke="#416c4f" strokeWidth="2"><path d="M60 130 Q205 160 413 92 M50 250 Q190 220 421 291 M38 360 Q249 397 421 320 M48 473 Q240 406 410 481" /></g>
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path className="road-base" d="M275 475 Q260 430 219 352 Q239 268 267 196" /><path className="road-flow flow-one" d="M275 475 Q260 430 219 352 Q239 268 267 196" />
    <path className="road-base" d="M275 475 Q223 494 160 491" /><path className="road-flow flow-two" d="M275 475 Q223 494 160 491" />
    <path className="road-base" d="M219 352 Q292 356 341 398" /><path className="road-flow flow-three" d="M219 352 Q292 356 341 398" />
    <path className="road-base" d="M160 491 Q136 483 111 472" /><path className="road-flow flow-two" d="M160 491 Q136 483 111 472" />
    <path className="road-base" d="M219 352 Q169 383 122 417" /><path className="road-flow flow-one" d="M219 352 Q169 383 122 417" />
    <path className="road-base" d="M341 398 Q359 352 345 300" /><path className="road-flow flow-three" d="M341 398 Q359 352 345 300" />
    <path className="road-base" d="M267 196 Q270 142 293 115" /><path className="road-flow flow-one" d="M267 196 Q270 142 293 115" />
    </g>
    <g className="city-mark"><circle cx="111" cy="472" r="5" /><circle cx="122" cy="417" r="5" /><circle cx="345" cy="300" r="5" /><circle cx="293" cy="115" r="5" /><circle cx="275" cy="475" r="7" /><circle cx="219" cy="352" r="7" /><circle cx="267" cy="196" r="7" /><circle cx="160" cy="491" r="7" /><circle cx="341" cy="398" r="7" /></g>
    <g className="moving-vehicle"><use href="#mapCar" /><animateMotion dur="13s" repeatCount="indefinite" rotate="auto" path="M275 475 Q260 430 219 352 Q239 268 267 196 Q230 269 219 352 Q260 430 275 475" /></g>
    <g className="moving-vehicle second"><use href="#mapCar" /><animateMotion dur="7s" repeatCount="indefinite" rotate="auto" path="M275 475 Q223 494 160 491 Q223 494 275 475" /></g>
    <g className="moving-vehicle third"><use href="#mapCar" /><animateMotion dur="11s" repeatCount="indefinite" path="M219 352 Q169 383 122 417 Q169 383 219 352" rotate="auto" /></g>
    <g className="moving-vehicle fourth"><use href="#mapCar" /><animateMotion dur="9s" repeatCount="indefinite" path="M341 398 Q359 352 345 300 Q359 352 341 398" rotate="auto" /></g>
    <g className="moving-vehicle fifth"><use href="#mapCar" /><animateMotion dur="10s" repeatCount="indefinite" path="M267 196 Q270 142 293 115 Q270 142 267 196" rotate="auto" /></g>
    </g>
    <g className="map-label"><text x="286" y="465">ACCRA</text><text x="126" y="551">CAPE COAST</text><text x="159" y="340">KUMASI</text><text x="279" y="181">TAMALE</text><text x="351" y="397">VOLTA</text><text x="26" y="463">TAKORADI</text><text x="54" y="407">OBUASI</text><text x="350" y="295">HO</text><text x="305" y="105">BOLGATANGA</text></g>
    </svg>
  )
}

const STOPS = [
  { index: '01', title: 'Tell us about your business', body: 'Share your company, service area and contact details.' },
  { index: '02', title: 'Introduce your vehicles', body: 'Show us your fleet, seating, condition and the journeys you can cover.' },
  { index: '03', title: 'Agree how we work together', body: 'Confirm rates, availability and operating details with our team before receiving requests.' },
]

const BENEFITS = [
  { number: '01', title: 'Be where travellers are planning.', body: 'Show your transport services alongside experiences people are exploring across Ghana.' },
  { number: '02', title: 'Work with the fleet you have.', body: 'Tell us your vehicle types, service area and availability so we can discuss requests that fit.' },
  { number: '03', title: 'Make room for more journeys.', body: 'Airport pickups, private rides, tours and groups can help put available vehicles to work.' },
  { number: '04', title: 'Coordinate with a local team.', body: 'Work with people in Ghana to discuss pickup details, changes and the journeys ahead.' },
]

export default function TransportProviderPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const storyRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<SVGSVGElement>(null)
  const activeStopRef = useRef(-1)
  const queuedRef = useRef(false)
  const journeyVisibleRef = useRef(true)
  const [motionPaused, setMotionPaused] = useState(false)

  // ── Reveal on scroll (the template's .reveal observer) ──────────────────
  useEffect(() => {
    const root = pageRef.current
    if (!root) return
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((n) => n.classList.add('visible'))
      return
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible')
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.1 },
    )
    nodes.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  // ── The journey: drive the road fill and mark the nearest stop ──────────
  // Lifted from the template, including the 55%-viewport focus line and the
  // 6–94% clamp, so the highway fill tracks the active step.
  const updateRoad = useCallback(() => {
    queuedRef.current = false
    const story = storyRef.current
    if (!story) return
    const road = story.querySelector<HTMLElement>('.vertical-highway')
    const stops = Array.from(story.querySelectorAll<HTMLElement>('.vertical-stop'))
    if (!road || stops.length === 0) return

    const focus = window.innerHeight * 0.55
    let nearest = 0
    let smallest = Infinity
    stops.forEach((stop, i) => {
      const rect = stop.getBoundingClientRect()
      const distance = Math.abs((rect.top + rect.bottom) / 2 - focus)
      if (distance < smallest) {
        smallest = distance
        nearest = i
      }
    })
    if (nearest === activeStopRef.current) return
    activeStopRef.current = nearest

    const card = stops[nearest].getBoundingClientRect()
    const highway = road.getBoundingClientRect()
    const aligned = ((card.top + card.height / 2 - highway.top) / highway.height) * 100
    const position = Math.max(6, Math.min(94, aligned))
    story.style.setProperty('--story-progress', position.toFixed(2) + '%')
    story.style.setProperty('--story-fill', position.toFixed(2) + '%')
    stops.forEach((stop, i) => stop.classList.toggle('active', i === nearest))
  }, [])

  useEffect(() => {
    const queue = () => {
      if (!journeyVisibleRef.current) return
      if (!queuedRef.current) {
        queuedRef.current = true
        requestAnimationFrame(updateRoad)
      }
    }
    const onResize = () => {
      activeStopRef.current = -1
      queue()
    }
    window.addEventListener('scroll', queue, { passive: true })
    window.addEventListener('resize', onResize)
    updateRoad()
    return () => {
      window.removeEventListener('scroll', queue)
      window.removeEventListener('resize', onResize)
    }
  }, [updateRoad])

  // The road fill is only measurable while the journey is on screen. Without
  // this gate every scroll frame anywhere on the page would pay for layout
  // reads on stops that are nowhere near the viewport.
  useEffect(() => {
    const story = storyRef.current
    if (!story || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      (entries) => {
        journeyVisibleRef.current = entries.some((entry) => entry.isIntersecting)
        if (journeyVisibleRef.current) updateRoad()
      },
      { rootMargin: '200px 0px' },
    )
    io.observe(story)
    return () => io.disconnect()
  }, [updateRoad])

  // ── Motion: the map's SMIL animations, honouring reduced motion ─────────
  // The template paused the SVG when prefers-reduced-motion matched. The
  // pause-all control extends that to every CSS animation via .tp-motion-paused.
  // The map also pauses whenever the hero is offscreen: an SMIL scene the
  // visitor cannot see is pure main-thread work during the rest of the scroll.
  useEffect(() => {
    const svg = mapRef.current
    if (!svg) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let heroVisible = true
    const apply = () => {
      if (reduced || motionPaused || !heroVisible) svg.pauseAnimations()
      else svg.unpauseAnimations()
    }
    const hero = heroRef.current
    if (!hero || !('IntersectionObserver' in window)) {
      apply()
      return
    }
    const io = new IntersectionObserver((entries) => {
      heroVisible = entries.some((entry) => entry.isIntersecting)
      apply()
    })
    io.observe(hero)
    apply()
    return () => io.disconnect()
  }, [motionPaused])

  return (
    <div ref={pageRef} className={motionPaused ? 'tp-page tp-motion-paused' : 'tp-page'}>
      <main>
        <SEO
          title="Become a Transport Partner in Ghana — List Your Fleet"
          description="From an airport welcome in Accra to the road north, your fleet helps people experience more of Ghana. Bring your vehicles and local knowledge and grow with the travellers already planning their trip."
          keywords="transport partner Ghana, list taxi Ghana, Ghana tour vehicle, airport transfer Ghana, transport provider Ghana, fleet partnership Ghana"
          jsonLd={[
            {
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              name: 'Transport Partners',
              description:
                'From an airport welcome in Accra to the road north, your fleet helps people experience more of Ghana. Bring your vehicles and local knowledge, and grow with the travellers already planning their trip.',
              url: 'https://www.travioghana.com/transport-providers',
              about: { '@type': 'Organization', name: 'Travio Ghana', url: 'https://www.travioghana.com' },
            },
          ]}
        />
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="hero ghana-hero" ref={heroRef}>
          <div className="wrap hero-inner ghana-hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">Travio Ghana · Transport partners</div>
              <h1>
                Move Ghana <em>with us.</em>
              </h1>
              <p className="hero-lead">
                From an airport welcome in Accra to the road north, your fleet helps people experience more of Ghana.
                Bring your vehicles and local knowledge, and grow with the travellers already planning their trip.
              </p>
              <div className="hero-actions">
                <a className="button" href={CONTACT}>
                  Become a transport partner <span className="link-arrow" aria-hidden="true">↗</span>
                </a>
                <a className="button outline" href="#journey">Explore the journeys</a>
              </div>
              <div className="hero-route-caption">
                <span className="route-caption-dot" /> ACCRA <span>·</span> CAPE COAST <span>·</span> KUMASI{' '}
                <span>·</span> TAMALE <small>AND THE ROADS BETWEEN</small>
              </div>
            </div>

            <div
              className="ghana-visual"
              aria-label="Illustrated map of Ghana showing moving vehicles between Accra, Cape Coast, Kumasi and Tamale"
              role="img"
            >
              <div className="visual-heading">
                <span>TRAVIO GHANA / ON THE MOVE</span>
                <span>
                  GH <b className="flag-stars">★</b>
                </span>
              </div>
              <GhanaMap svgRef={mapRef} />
              <div className="visual-footer">
                <span><i /> ROUTES IN MOTION</span>
                <button
                  type="button"
                  className="motion-toggle"
                  aria-pressed={motionPaused}
                  onClick={() => setMotionPaused((p) => !p)}
                >
                  {motionPaused ? 'Play motion' : 'Pause motion'}
                </button>
                <span>YOUR FLEET CAN GO FURTHER</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── How to join ──────────────────────────────────────────────── */}
        <section className="journey vertical-journey" id="journey">
          <div className="wrap vertical-heading reveal">
            <div className="eyebrow section-label">How to join</div>
            <h2>Become a transport partner.</h2>
            <p>Tell us about your operation, then we’ll discuss the vehicles, routes and working details together.</p>
          </div>
          <div className="wrap vertical-story" ref={storyRef}>
            <div className="vertical-highway" aria-hidden="true">
              <div className="highway-asphalt">
                <div className="highway-divider" />
                <div className="road-progress" />
              </div>
              <div className="highway-sign sign-1">GET STARTED</div>
              <div className="highway-sign sign-2">READY TO GO</div>
              <div className="vertical-traffic traffic-one" aria-hidden="true"><svg viewBox="0 0 80 140"><ellipse cx="40" cy="72" rx="29" ry="64" fill="#031a16" opacity=".4" /><rect x="11" y="7" width="58" height="126" rx="19" fill="#f4bf78" stroke="#ffdfa9" strokeWidth="3" /><path d="M18 29 Q40 19 62 29 L62 55 H18Z M18 93 Q40 86 62 93 L62 111 Q40 118 18 111Z" fill="#20453e" /><path d="M20 123h40" stroke="#ee684c" strokeWidth="5" /></svg></div>
            <div className="vertical-traffic traffic-two" aria-hidden="true"><svg viewBox="0 0 80 140"><ellipse cx="40" cy="72" rx="29" ry="64" fill="#031a16" opacity=".4" /><rect x="11" y="7" width="58" height="126" rx="19" fill="#86cbb1" stroke="#dbf3cf" strokeWidth="3" /><path d="M18 29 Q40 19 62 29 L62 55 H18Z M18 93 Q40 86 62 93 L62 111 Q40 118 18 111Z" fill="#20453e" /><path d="M20 123h40" stroke="#ee684c" strokeWidth="5" /></svg></div>
            <div className="vertical-traffic traffic-three" aria-hidden="true"><svg viewBox="0 0 80 140"><ellipse cx="40" cy="72" rx="29" ry="64" fill="#031a16" opacity=".4" /><rect x="11" y="7" width="58" height="126" rx="19" fill="#f6e9cd" stroke="#fff8e5" strokeWidth="3" /><path d="M18 29 Q40 19 62 29 L62 55 H18Z M18 93 Q40 86 62 93 L62 111 Q40 118 18 111Z" fill="#20453e" /><path d="M20 123h40" stroke="#ee684c" strokeWidth="5" /></svg></div>
            <div className="vertical-traffic traffic-four" aria-hidden="true"><svg viewBox="0 0 80 140"><ellipse cx="40" cy="72" rx="29" ry="64" fill="#031a16" opacity=".4" /><rect x="11" y="7" width="58" height="126" rx="19" fill="#e59884" stroke="#ffdbc3" strokeWidth="3" /><path d="M18 29 Q40 19 62 29 L62 55 H18Z M18 93 Q40 86 62 93 L62 111 Q40 118 18 111Z" fill="#20453e" /><path d="M20 123h40" stroke="#ee684c" strokeWidth="5" /></svg></div>
              <div className="vertical-car" aria-label="Vehicle travelling down the journey as you scroll">
                <svg viewBox="0 0 100 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Top view of a Travio Ghana vehicle"><defs><linearGradient id="vanBody" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f0f9c8" /><stop offset=".55" stopColor="#d7ec98" /><stop offset="1" stopColor="#83b780" /></linearGradient><linearGradient id="vanGlass" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#346c71" /><stop offset="1" stopColor="#8dbdb6" /></linearGradient></defs><ellipse cx="50" cy="92" rx="45" ry="86" fill="#00170f" opacity=".28" /><rect x="9" y="27" width="9" height="37" rx="4" fill="#0e241c" /><rect x="82" y="27" width="9" height="37" rx="4" fill="#0e241c" /><rect x="9" y="115" width="9" height="38" rx="4" fill="#0e241c" /><rect x="82" y="115" width="9" height="38" rx="4" fill="#0e241c" /><rect x="16" y="8" width="68" height="164" rx="23" fill="url(#vanBody)" stroke="#124b34" strokeWidth="3" /><path d="M24 32Q50 19 76 32v23H24Z" fill="url(#vanGlass)" stroke="#174a42" strokeWidth="2" /><path d="M25 122q25-12 50 0v25q-25 10-50 0Z" fill="url(#vanGlass)" stroke="#174a42" strokeWidth="2" /><rect x="32" y="63" width="36" height="51" rx="9" fill="#b5da9b" stroke="#5c996c" strokeWidth="2" /><path d="M26 90h48" stroke="#ffffff" strokeWidth="3" opacity=".55" /><rect x="25" y="11" width="15" height="6" rx="2" fill="#e66f4a" /><rect x="60" y="11" width="15" height="6" rx="2" fill="#e66f4a" /><path d="M27 164h46" stroke="#fff7c3" strokeWidth="5" strokeLinecap="round" /></svg><span className="car-light"></span>
              </div>
            </div>
            <div className="vertical-stops">
              {STOPS.map((s) => (
                <article className="vertical-stop" data-stop={s.index} key={s.index}>
                  <span className="stop-index">{s.index}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="wrap journey-join">
            <a className="button" href={CONTACT}>
              Start the conversation <span className="link-arrow" aria-hidden="true">↗</span>
            </a>
          </div>
        </section>

        {/* ── Why join ─────────────────────────────────────────────────── */}
        <section className="proposition partner-benefits" id="benefits">
          <div className="wrap benefits-layout">
            <div className="benefits-intro reveal">
              <div className="eyebrow section-label">Why join Travio Ghana</div>
              <h2>Good journeys start with good partners.</h2>
              <p>
                Share your vehicles and local know-how. We’ll work together to match the right journeys with what your
                business can offer.
              </p>
              <a href="#journey" className="benefits-link">
                See how to join <span className="link-arrow" aria-hidden="true">↗</span>
              </a>
            </div>
            <div className="benefits-list">
              {BENEFITS.map((b) => (
                <article className="benefit-row reveal" key={b.number}>
                  <span className="benefit-number">{b.number}</span>
                  <div>
                    <h3>{b.title}</h3>
                    <p>{b.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
