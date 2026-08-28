import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Edit3, Trash2, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMyReviews, useDeleteReview, type MyReviewData } from "../../hooks/useExpeditionReviews";
import OptimizedImage from "@/components/shared/OptimizedImage";

const REVIEW_DRAFT_PREFIX = "eg_review_draft:";

const EDIT_WINDOW_MS = 15 * 60 * 1000;

function getDraftKey(tourTitle: string) {
  return `${REVIEW_DRAFT_PREFIX}${encodeURIComponent(tourTitle || "unknown-tour")}`;
}

function getTimeLeft(now: number, submittedAt: string): string | null {
  const elapsed = now - new Date(submittedAt).getTime();
  const remaining = EDIT_WINDOW_MS - elapsed;
  if (remaining <= 0) return null;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export default function ReviewsPage() {
  const navigate = useNavigate();
  const { data: reviews = [], isLoading, isError } = useMyReviews();
  const deleteReview = useDeleteReview();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleDelete = async (review: MyReviewData) => {
    try {
      await deleteReview.mutateAsync(review.id);
      toast.success("Review deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete review");
    }
  };

  const handleEdit = (review: MyReviewData) => {
    const elapsed = now - new Date(review.createdAt).getTime();
    if (elapsed > EDIT_WINDOW_MS) {
      toast.error("Edit window has expired. Reviews can only be edited within 15 minutes of posting.");
      return;
    }

    const draftData = {
      overallRating: review.rating,
      reviewText: review.comment,
    };
    try {
      sessionStorage.setItem(getDraftKey(review.tourTitle), JSON.stringify(draftData));
    } catch { console.warn("Failed to save draft"); }

    const tour = {
      title: review.tourTitle,
      image: review.tourImage || '',
      location: review.tourLocation,
      slug: review.tourSlug,
      rating: review.rating,
      tourId: review.tourId,
    };

    navigate(`/review/${review.tourSlug}`, {
      state: { tour, returnTo: "/dashboard/reviews", bookingId: review.bookingId, editingReviewId: review.id },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-[#6b7280]">
        Loading your reviews...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-white rounded-2xl border border-[#e5e4e7] shadow-sm">
        <h3 className="text-xl font-heading font-semibold text-[#1a1a1a] mb-2">Couldn't load your reviews</h3>
        <p className="text-sm text-[#6b7280] max-w-sm leading-relaxed">
          Something went wrong while fetching your reviews. Please try again later.
        </p>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-white rounded-2xl border border-[#e5e4e7] shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#065f46] to-[#10b981] flex items-center justify-center mb-5 shadow-lg shadow-[#065f46]/20">
          <Star size={30} className="text-white fill-white" />
        </div>
        <h3 className="text-xl font-heading font-semibold text-[#1a1a1a] mb-2">No Reviews Yet</h3>
        <p className="text-sm text-[#6b7280] max-w-sm leading-relaxed mb-7">
          You haven't reviewed any tours yet. Share your experience to help other travelers!
        </p>
        <Button onClick={() => navigate('/tours')} className="bg-[#065f46] text-white hover:bg-[#047857]">Browse Tours</Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <AnimatePresence mode="popLayout">
        {reviews.map((review) => {
          const canEdit = now - new Date(review.createdAt).getTime() <= EDIT_WINDOW_MS;
          const timeLeft = canEdit ? getTimeLeft(now, review.createdAt) : null;

          return (
            <motion.div
              key={review.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25 }}
              className="bg-white rounded-2xl border border-[#e5e4e7] overflow-hidden shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:gap-4 sm:p-5">
                <div className="relative w-full h-44 sm:w-[72px] sm:h-[72px] sm:rounded-lg overflow-hidden shrink-0 bg-[#f3f4f6]">
                  {review.tourImage && (
                    <OptimizedImage src={review.tourImage} alt={review.tourTitle} className="w-full h-full object-cover" width={200} />
                  )}
                </div>

                <div className="flex-1 min-w-0 p-4 sm:p-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-heading font-semibold text-[#1a1a1a] line-clamp-2 sm:truncate">{review.tourTitle}</h3>
                      <p className="text-[13px] text-[#6b7280] mt-0.5">{review.tourLocation}</p>
                      {review.status === 'PENDING' && (
                        <span className="inline-block mt-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                          Pending approval
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            className={i < review.rating ? "text-[#179237] fill-[#179237]" : "text-[#d1d5db]"}
                          />
                        ))}
                      </div>
                      <span className="text-[13px] font-semibold text-[#1a1a1a]">
                        {Number(review.rating).toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {review.title && (
                    <p className="text-[14px] font-semibold text-[#1a1a1a] mt-2">{review.title}</p>
                  )}
                  <p className={`text-[14px] text-[#4b5563] mt-1 leading-relaxed ${expandedId !== review.id && review.comment.length > 120 ? "line-clamp-2" : ""}`}>
                    {review.comment}
                  </p>

                  {review.comment.length > 120 && (
                    <button
                      onClick={() => setExpandedId(expandedId === review.id ? null : review.id)}
                      className="flex items-center gap-1 text-[13px] font-medium text-[#065f46] mt-1.5 hover:underline"
                    >
                      {expandedId === review.id ? "Show less" : "Read more"}
                      {expandedId === review.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}

                  <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[#e5e4e7] flex-nowrap min-w-0">
                    <span className="text-[13px] text-[#9ca3af] truncate min-w-0">
                      {new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                      {canEdit ? (
                        <button
                          onClick={() => handleEdit(review)}
                          className="flex items-center gap-1 sm:gap-1.5 text-[12px] sm:text-[13px] font-medium text-[#6b7280] hover:text-[#065f46] transition-colors px-2 sm:px-2.5 py-1.5 rounded-lg hover:bg-[#f0fdf4]"
                        >
                          <Edit3 size={12} className="sm:size-[13px]" />
                          Edit
                          {timeLeft && (
                            <span className="hidden sm:flex items-center gap-0.5 text-[11px] text-[#9ca3af] ml-1">
                              <Clock size={10} />
                              {timeLeft}
                            </span>
                          )}
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 sm:gap-1.5 text-[12px] sm:text-[13px] text-[#d1d5db] px-2 sm:px-2.5 py-1.5 select-none cursor-not-allowed">
                          <Edit3 size={12} className="sm:size-[13px]" />
                          Edit
                        </span>
                      )}
                      <button
                        onClick={() => handleDelete(review)}
                        disabled={deleteReview.isPending}
                        className="flex items-center gap-1 sm:gap-1.5 text-[12px] sm:text-[13px] font-medium text-[#6b7280] hover:text-[#ef4444] transition-colors px-2 sm:px-2.5 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 size={12} className="sm:size-[13px]" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
