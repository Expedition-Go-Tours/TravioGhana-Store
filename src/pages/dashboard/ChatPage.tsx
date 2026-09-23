import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  Headphones,
  MessageCircle,
  MessagesSquare,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useChat, otherParticipant } from "@/chat/ChatContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import ChatThread from "@/chat/ChatThread";
import { uploadChatImage } from "@/chat/chatApi";

/* Support-thread conversation types. The fixed "Admin Support" entry at the
   top of the list is their single entry point — support threads are never
   rendered as regular rows below it, so opening one never leaves a duplicate
   row underneath. */
function isSupportConversation(conversation: { type?: string }): boolean {
  return conversation.type === "USER_SUPPORT" || conversation.type === "EXPEDITION_CUSTOMER";
}

/* ── Smart relative date labels ────────────────────────────────── */
function smartDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isYesterday) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/* ── Full timestamp for hover ──────────────────────────────────── */
function fullTimestamp(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatPage() {
  const { t } = useTranslation();
  const chat = useChat();
  const user = useAuthUser();
  const myUserId = user?.id || user?._id || user?.uid || user?.firebaseUid;
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileThread, setMobileThread] = useState(() => !!searchParams.get("conversation"));
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const activeConversation = useMemo(
    () => chat.conversations.find((c) => c.id === chat.activeConversationId) ?? null,
    [chat.conversations, chat.activeConversationId],
  );
  const other = activeConversation ? otherParticipant(activeConversation, myUserId) : undefined;
  const isSupportActive = activeConversation ? isSupportConversation(activeConversation) : false;
  const activeName = isSupportActive
    ? t("supportChat.adminSupport")
    : other?.name || activeConversation?.title || t("supportChat.expeditionSupport");
  const activePhoto = other?.photoURL ?? null;
  const activeMessages = chat.activeConversationId ? (chat.messages[chat.activeConversationId] ?? []) : [];
  const otherLastReadAt = other
    ? (activeConversation?.participants?.find((p) => p.userId === other.id)?.lastReadAt ?? null)
    : null;
  const activeTypingUserId = chat.activeConversationId ? chat.typingUserId[chat.activeConversationId] : null;

  /* ── Deep link ────────────────────────────────────────────────── */
  const processedDeepLink = useRef<string | null>(null);
  useEffect(() => {
    const id = searchParams.get("conversation");
    if (!id) {
      processedDeepLink.current = null;
      return;
    }
    if (processedDeepLink.current === id) return;
    if (chat.conversations.some((c) => c.id === id)) {
      processedDeepLink.current = id;
      chat.openConversation(id);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, chat.conversations]);

  const goSupportChat = async () => {
    try {
      await chat.openSupportChat();
      setMobileThread(true);
    } catch {
      toast.error(t("supportChat.supportUnavailable"));
    }
  };

  const goConversation = (id: string) => {
    chat.openConversation(id);
    setMobileThread(true);
  };

  /* ── Filtered + searched conversations ─────────────────────────── */
  const filteredConversations = useMemo(() => {
    let list = chat.conversations.filter((c) => !isSupportConversation(c));
    if (filter === "unread") {
      list = list.filter((c) => (c.unreadCount ?? 0) > 0);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => {
        const otherUser = otherParticipant(c, myUserId);
        const name = (otherUser?.name || c.title || "").toLowerCase();
        const lastMsg = c.messages?.[0]?.content?.toLowerCase() ?? "";
        return name.includes(q) || lastMsg.includes(q);
      });
    }
    return list;
  }, [chat.conversations, filter, searchQuery, myUserId]);

  const totalUnread = chat.conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
  const supportUnread = chat.conversations.reduce(
    (sum, c) => sum + (isSupportConversation(c) ? (c.unreadCount ?? 0) : 0),
    0,
  );
  const hasSupplierConversations = chat.conversations.some((c) => !isSupportConversation(c));

  return (
    <div className="dash-chat-shell">
      {/* ── Conversation list pane ──────────────────────────── */}
      <div className={`dash-chat-list ${mobileThread ? "hidden-mobile" : ""}`}>
        <div className="dash-chat-list-header">
          <MessagesSquare size={18} className="text-[var(--bv-accent)]" />
          <h3>{t("supportChat.myChats")}</h3>
          {totalUnread > 0 && (
            <span className="ml-auto min-w-[20px] h-[20px] px-1.5 rounded-full bg-[var(--bv-accent)] text-white text-[11px] font-bold flex items-center justify-center">
              {Math.min(totalUnread, 99)}
            </span>
          )}
        </div>

        {/* Search */}
        <div className="dash-chat-search-wrap">
          <div className="dash-chat-search">
            <Search size={15} className="text-[var(--bv-faint)] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("supportChat.searchPlaceholder", "Search conversations...")}
              aria-label={t("supportChat.searchPlaceholder", "Search conversations")}
            />
            {searchQuery && (
              <button
                type="button"
                className="dash-chat-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="dash-chat-filters">
          <button
            className={`dash-chat-filter ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            {t("supportChat.all", "All")}
          </button>
          <button
            className={`dash-chat-filter ${filter === "unread" ? "active" : ""}`}
            onClick={() => setFilter("unread")}
          >
            {t("supportChat.unread", "Unread")}
            {totalUnread > 0 && (
              <span className="ml-1.5 text-[11px] opacity-70">{totalUnread}</span>
            )}
          </button>
        </div>

        {/* Conversation list */}
        <div className="dash-chat-conv-list">
          {/* Admin Support button */}
          <button className="dash-chat-support-btn" onClick={goSupportChat} aria-label={t("supportChat.adminSupport")}>
            <div className="dash-chat-conv-avatar">
              <Headphones size={17} />
            </div>
            <div className="dash-chat-conv-info">
              <p className="dash-chat-conv-name">{t("supportChat.adminSupport")}</p>
              <p className="dash-chat-conv-preview">{t("supportChat.chatWithSupportSub")}</p>
            </div>
            {supportUnread > 0 && (
              <div className="dash-chat-conv-meta">
                <span className="dash-chat-conv-unread">{Math.min(supportUnread, 99)}</span>
              </div>
            )}
          </button>

          {/* Empty state — no conversations */}
          {filteredConversations.length === 0 && !hasSupplierConversations && (
            <div className="dash-chat-empty" style={{ padding: "32px 16px" }}>
              <MessageCircle size={28} className="text-[var(--bv-faint)]" />
              <p className="dash-chat-empty-title">{t("supportChat.noConversations")}</p>
              <p className="dash-chat-empty-text">{t("supportChat.noConversationsSub")}</p>
            </div>
          )}

          {/* Empty state — no search results */}
          {filteredConversations.length === 0 && hasSupplierConversations && searchQuery && (
            <div className="dash-chat-empty" style={{ padding: "32px 16px" }}>
              <Search size={24} className="text-[var(--bv-faint)]" />
              <p className="dash-chat-empty-title">{t("supportChat.noResults", "No results")}</p>
              <p className="dash-chat-empty-text">
                {t("supportChat.noResultsSub", 'No conversations match "{{query}}"', { query: searchQuery })}
              </p>
            </div>
          )}

          {/* Empty state — no unread */}
          {filteredConversations.length === 0 && hasSupplierConversations && filter === "unread" && !searchQuery && (
            <div className="dash-chat-empty" style={{ padding: "32px 16px" }}>
              <MessageCircle size={24} className="text-[var(--bv-faint)]" />
              <p className="dash-chat-empty-title">{t("supportChat.allRead", "All caught up")}</p>
              <p className="dash-chat-empty-text">{t("supportChat.allReadSub", "No unread messages.")}</p>
            </div>
          )}

          {filteredConversations.map((conv) => {
            const otherUser = otherParticipant(conv, myUserId);
            const name = otherUser?.name || conv.title || t("supportChat.expeditionSupport");
            const last = conv.messages?.[0];
            const active = conv.id === chat.activeConversationId;
            const unread = conv.unreadCount ?? 0;
            return (
              <button
                key={conv.id}
                onClick={() => goConversation(conv.id)}
                className={`dash-chat-conv-item ${active ? "active" : ""}`}
                aria-label={`${name}, ${unread > 0 ? `${unread} unread` : t("supportChat.noUnread", "no unread")}`}
              >
                <div className="dash-chat-conv-avatar">
                  {otherUser?.photoURL ? (
                    <img src={otherUser.photoURL} alt="" />
                  ) : (
                    name.charAt(0).toUpperCase()
                  )}
                  <span className={`dash-chat-status-dot ${otherUser?.lastLoginAt ? "online" : "offline"}`} />
                </div>
                <div className="dash-chat-conv-info">
                  <p className="dash-chat-conv-name">{name}</p>
                  <p className="dash-chat-conv-preview">
                    {last
                      ? last.attachmentUrl
                        ? `${t("supportChat.imageAttachment", "Photo")}`
                        : last.content
                      : t("supportChat.startConversation")}
                  </p>
                </div>
                <div className="dash-chat-conv-meta">
                  <span className="dash-chat-conv-time" title={fullTimestamp(conv.updatedAt)}>
                    {smartDate(conv.updatedAt)}
                  </span>
                  {unread > 0 && (
                    <span className="dash-chat-conv-unread">{Math.min(unread, 99)}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Thread pane ─────────────────────────────────────── */}
      <div className={`dash-chat-thread ${mobileThread ? "" : "hidden-mobile"}`}>
        {activeConversation ? (
          <>
            <div className="dash-chat-thread-header">
              <button
                onClick={() => setMobileThread(false)}
                className="dash-chat-back-btn"
                aria-label="Back to conversations"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="dash-chat-thread-avatar">
                {!isSupportActive && activePhoto ? (
                  <img src={activePhoto} alt="" />
                ) : (
                  <Headphones size={17} />
                )}
              </div>
              <div className="dash-chat-thread-info">
                <p className="dash-chat-thread-name">{activeName}</p>
                <div className="dash-chat-thread-status">
                  <span className="dash-chat-status-dot online" />
                  <span>{t("supportChat.online")}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
              <ChatThread
                messages={activeMessages}
                myUserId={myUserId}
                statuses={chat.messageStatuses}
                otherLastReadAt={otherLastReadAt}
                isTyping={!!activeTypingUserId}
                typingName={activeTypingUserId === other?.id ? other.name : undefined}
                onSend={chat.sendMessage}
                onLoadMore={() => chat.activeConversationId && chat.loadMore(chat.activeConversationId)}
                hasMore={chat.activeConversationId ? chat.hasMore[chat.activeConversationId] : false}
                onTyping={(v) => chat.activeConversationId && chat.setTyping(chat.activeConversationId, v)}
                onUpload={uploadChatImage}
                allowDelete
                onDeleteMessage={(messageId) =>
                  chat.activeConversationId
                    ? chat.hideMessageForMe(chat.activeConversationId, messageId)
                    : Promise.resolve()
                }
                emptyText={t("supportChat.startConversation")}
              />
            </div>
          </>
        ) : (
          <div className="dash-chat-empty">
            <div className="dash-chat-empty-icon">
              <MessagesSquare size={26} />
            </div>
            <p className="dash-chat-empty-title">{t("supportChat.noConversationSelected")}</p>
            <p className="dash-chat-empty-text">{t("supportChat.noConversationSelectedSub")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
