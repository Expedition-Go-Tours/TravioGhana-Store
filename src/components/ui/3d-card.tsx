import React, { useState, useEffect, useRef } from 'react';
import image01Src from '../../assets/Image01.webp';
import image02Src from '../../assets/Image02.webp';
import image03Src from '../../assets/Image03.webp';
import image04Src from '../../assets/Image04.webp';
import img3538Src from '../../assets/IMG_3538.webp';
import quadBikingSrc from '../../assets/images/QuadBiking.webp';

// Fanned Cards Component (for first FAQ section)
export function FannedCardsComponent() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(2);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const cards = [
    { src: img3538Src, label: 'SCENIC', rotation: -25 },
    { src: quadBikingSrc, label: 'THRILL', rotation: -12 },
    { src: image01Src, label: 'EXPLORE', rotation: 0, featured: true },
    { src: image02Src, label: 'CULTURE', rotation: 12 },
    { src: image03Src, label: 'NATURE', rotation: 25 },
  ];

  return (
    <div className="relative w-full h-[300px] flex items-center justify-center overflow-hidden">
      <div className="relative w-[320px] h-[280px]">
        {cards.map((card, index) => {
          const isActive = index === activeIndex;
          const offset = index - 2;
          const translateX = offset * 65;
          const rotation = offset * 12;
          const scale = isActive ? 1 : 0.85;
          const zIndex = isActive ? 10 : 5 - Math.abs(offset);

          return (
            <div
              key={index}
              className="absolute left-1/2 top-1/2 cursor-pointer transition-all duration-500 ease-out"
              style={{
                transform: `translate(-50%, -50%) translateX(${translateX}px) rotate(${rotation}deg) scale(${scale})`,
                zIndex,
                opacity: isVisible ? 1 : 0,
                transitionDelay: `${index * 100}ms`,
              }}
              onClick={() => setActiveIndex(index)}
            >
              <div className={`relative w-[120px] h-[180px] sm:w-[140px] sm:h-[210px] rounded-xl overflow-hidden shadow-2xl ${isActive ? 'ring-2 ring-white/50' : ''}`}>
                <img
                  src={card.src}
                  alt={card.label}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full">
                  <span className="text-[8px] font-bold tracking-wider text-gray-800">{card.label}</span>
                </div>
                {isActive && (
                  <div className="absolute bottom-2 left-2 right-2 text-white">
                    <p className="text-xs font-bold">{card.label === 'EXPLORE' ? 'Safari Adventures' : card.label === 'SCENIC' ? 'Scenic Tours' : card.label === 'THRILL' ? 'Quad Biking' : card.label === 'CULTURE' ? 'Cultural Tours' : 'Nature Walks'}</p>
                    <p className="text-[9px] text-white/80 mt-0.5">Discover experiences</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Auto-moving Cards Component (for second FAQ section)
export function AutoMovingCardsComponent() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const cards = [
    { src: img3538Src },
    { src: quadBikingSrc },
    { src: image01Src },
    { src: image04Src },
  ];

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % cards.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [isPaused, cards.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    // Only register horizontal swipes (ignore vertical scrolling)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX < 0) {
        // Swipe left - go to next card
        setCurrentIndex((prev) => (prev + 1) % cards.length);
      } else {
        // Swipe right - go to previous card
        setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div
      className="relative w-full h-[340px] sm:h-[380px] lg:h-[500px] flex items-center justify-center mx-auto"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative w-[280px] h-[260px] sm:w-[340px] sm:h-[320px] lg:w-[420px] lg:h-[440px] mx-auto">
        {cards.map((card, index) => {
          const offset = ((index - currentIndex + cards.length) % cards.length);
          const normalizedOffset = offset > cards.length / 2 ? offset - cards.length : offset;
          const translateX = normalizedOffset * 70;
          const rotation = normalizedOffset * 8;
          const scale = normalizedOffset === 0 ? 1 : 0.8;
          const opacity = Math.abs(normalizedOffset) <= 1 ? 1 : 0.5;
          const zIndex = 10 - Math.abs(normalizedOffset);

          return (
            <div
              key={index}
              className="absolute left-1/2 top-1/2 transition-all duration-600 ease-out"
              style={{
                transform: `translate(-50%, -50%) translateX(${translateX}px) rotate(${rotation}deg) scale(${scale})`,
                zIndex,
                opacity,
              }}
            >
              <div className={`relative w-[150px] h-[220px] sm:w-[170px] sm:h-[250px] lg:w-[220px] lg:h-[320px] rounded-xl overflow-hidden shadow-xl ${normalizedOffset === 0 ? 'ring-2 ring-green-500/50' : ''}`}>
                <img
                  src={card.src}
                  alt="Travio Ghana Tour"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                {/* Travio Ghana Logo */}
                <div className="absolute top-3 left-3">
                  <img src="/logo.png" alt="Travio Ghana" className="h-10 sm:h-12 lg:h-14 drop-shadow-lg" />
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation dots - hidden on mobile */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden sm:flex gap-2">
        {cards.map((_, index) => (
          <button
            key={index}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${index === currentIndex ? 'bg-green-500 w-7' : 'bg-gray-300'}`}
            onClick={() => setCurrentIndex(index)}
            aria-label={`Go to card ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

// Legacy component for backwards compatibility
export function PhotoCardsComponent() {
  return <FannedCardsComponent />;
}

export default PhotoCardsComponent;
