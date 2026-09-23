import { useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import StarRating from "@/components/StarRating";
import { useMyReviews } from "../../hooks/useExpeditionReviews";
import OptimizedImage from "@/components/shared/OptimizedImage";

const DotLottieReact = lazy(() =>
  import('@lottiefiles/dotlottie-react').then((m) => ({ default: m.DotLottieReact }))
)

export default function ReviewsPage() {
  const navigate = useNavigate();
  const { data: reviews = [], isLoading, isError } = useMyReviews();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-[var(--bv-muted)]">
        Loading your reviews...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-white rounded-2xl border border-[var(--bv-border)] shadow-sm">
        <h3 className="text-xl font-heading font-semibold text-[var(--bv-ink)] mb-2">Couldn't load your reviews</h3>
        <p className="text-sm text-[var(--bv-muted)] max-w-sm leading-relaxed">
          Something went wrong while fetching your reviews. Please try again later.
        </p>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-white rounded-2xl border border-[var(--bv-border)] shadow-sm">
        <div className="w-full max-w-md mb-5">
          <Suspense fallback={<div className="w-full aspect-[4/3]" aria-hidden="true" />}>
            <DotLottieReact
              src="/animations/reviews-empty.lottie"
              loop
              autoplay
              style={{ width: '100%', height: 'auto' }}
            />
          </Suspense>
        </div>
        <h3 className="text-xl font-heading font-semibold text-[var(--bv-ink)] mb-2">No Reviews Yet</h3>
        <p className="text-sm text-[var(--bv-muted)] max-w-sm leading-relaxed mb-7">
          You haven't reviewed any tours yet. Share your experience to help other travelers!
        </p>
        <Button onClick={() => navigate('/tours')} className="bg-[var(--bv-accent)] text-white hover:bg-[var(--bv-accent-strong)] rounded-xl">
          Browse Tours
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto space-y-4">
      <AnimatePresence mode="popLayout">
        {reviews.map((review) => (
          <motion.div
            key={review.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.25 }}
            className="bg-white rounded-2xl border border-[var(--bv-border)] shadow-sm overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-start gap-3">
                <OptimizedImage
                  src={review.tourImage}
                  alt={review.tourTitle}
                  className="w-16 h-16 rounded-xl object-cover"
                  width={64}
                  height={64}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-heading font-semibold text-[var(--bv-ink)] truncate">
                    {review.tourTitle}
                  </h3>
                  <div className="flex items-center gap-1 mt-1">
                    <StarRating
                      value={review.rating}
                      size={16}
                      gap={2}
                      filledColor="var(--bv-accent)"
                      emptyColor="#e5e7eb"
                    />
                    <span className="text-sm text-[var(--bv-muted)] ml-1">
                      {review.rating}/5
                    </span>
                  </div>
                  <p className="text-xs text-[var(--bv-muted)] mt-1">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => setExpandedId(expandedId === review.id ? null : review.id)}
                  className="p-1 hover:bg-[var(--bv-accent-soft)] rounded-lg transition-colors"
                >
                  {expandedId === review.id ? (
                    <ChevronUp size={18} className="text-[var(--bv-muted)]" />
                  ) : (
                    <ChevronDown size={18} className="text-[var(--bv-muted)]" />
                  )}
                </button>
              </div>
              <AnimatePresence>
                {expandedId === review.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="mt-3 text-sm text-[var(--bv-ink)] leading-relaxed">
                      {review.comment}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
