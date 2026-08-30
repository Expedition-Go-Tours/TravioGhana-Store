import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  MessageCircle, X, ChevronLeft, ChevronRight,
  Phone, Mail, Clock, Headphones, MessagesSquare, LogIn,
} from 'lucide-react';
import { toast } from 'sonner';
import './SupportChatWidget.css';
import { useChat, otherParticipant } from '../chat/ChatContext';
import { useAuthUser } from '../hooks/useAuthUser';
import ChatThread from '../chat/ChatThread';
import { uploadChatImage } from '../chat/chatApi';
import type { ChatRecipient } from '../chat/types';

const SUPPORT_PHONE = "+233 XX XXX XXXX";
const SUPPORT_EMAIL = "support@travioghana.com";
const SUPPORT_HOURS = [
  { label: "Mon - Fri", value: "8:00 AM - 6:00 PM" },
  { label: "Saturday", value: "9:00 AM - 2:00 PM" },
  { label: "Sunday", value: "Closed" },
];

interface SupportChatWidgetProps {
  initialOpen?: boolean
  /** Opens straight into a chat with this recipient (e.g. the tour's supplier). */
  initialRecipient?: ChatRecipient | null
  onOpenAuth?: (mode: 'signin' | 'signup') => void
}

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const mins = Math.floor((now - then) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function SupportChatWidget({ initialOpen, initialRecipient, onOpenAuth }: SupportChatWidgetProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const isPublicPage = !location.pathname.startsWith("/dashboard") && !location.pathname.startsWith("/review");

  const chat = useChat();
  const user = useAuthUser();
  const myUserId = user?.id || user?._id || user?.uid || user?.firebaseUid;

  const [isOpen, setIsOpen] = useState(!!initialOpen);
  const [view, setView] = useState<"welcome" | "signin" | "contact" | "chats" | "chat">(
    initialRecipient?.id ? "chat" : "welcome",
  );
  const [isMobile, setIsMobile] = useState(false);
  const autoOpenedRef = useRef(false);

  const activeConversation = chat.conversations.find((c) => c.id === chat.activeConversationId) ?? null;
  const other = activeConversation ? otherParticipant(activeConversation, myUserId) : undefined;
  const activeName = other?.name || activeConversation?.title || t('supportChat.expeditionSupport');
  const activePhoto = other?.photoURL ?? null;
  const activeMessages = chat.activeConversationId ? (chat.messages[chat.activeConversationId] ?? []) : [];
  const otherLastReadAt = other
    ? (activeConversation?.participants?.find((p) => p.userId === other.id)?.lastReadAt ?? null)
    : null;
  const activeTypingUserId = chat.activeConversationId ? chat.typingUserId[chat.activeConversationId] : null;
  const activeTypingName = activeTypingUserId === other?.id ? other.name : undefined;

  // Tour detail: open the supplier conversation immediately.
  useEffect(() => {
    if (!isOpen || autoOpenedRef.current) return;
    if (initialRecipient?.id && user) {
      autoOpenedRef.current = true;
      chat.openSupplierChat(initialRecipient).catch(() => {
        toast.error(t('supportChat.chatStartFailed'));
      });
    }
  }, [isOpen, initialRecipient, user, chat, t]);

  // Track the mobile breakpoint (matches the full-screen popup CSS at 768px)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Lock background scroll while the chat is open so the page behind the
  // full-screen overlay doesn't scroll.
  useEffect(() => {
    if (!isOpen || !isMobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isMobile]);

  const openWidget = () => {
    setIsOpen(true);
    setView("welcome");
  };

  const closeWidget = () => {
    setIsOpen(false);
    setView("welcome");
    chat.closeConversation();
  };

  const goChats = useCallback(() => {
    setView(user ? "chats" : "signin");
  }, [user]);

  const goSupportChat = useCallback(async () => {
    try {
      await chat.openSupportChat();
      setView("chat");
    } catch {
      toast.error(t('supportChat.supportUnavailable'));
    }
  }, [chat, t]);

  const goConversation = useCallback((id: string) => {
    chat.openConversation(id);
    setView("chat");
  }, [chat]);

  if (!isPublicPage) return null;

  const conversations = chat.conversations;

  return (
    <>
      {/* Edge toggle */}
      <button
        onClick={isOpen ? closeWidget : openWidget}
        className={`support-chat-btn${isOpen ? " open" : ""}`}
        aria-label={isOpen ? t('supportChat.closeChat') : t('supportChat.openChat')}
        aria-expanded={isOpen}
      >
        <span className="support-chat-btn-body">
          <span className="support-chat-btn-icon-wrap">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isOpen ? "close" : "open"}
                className="support-chat-btn-icon"
                initial={{ scale: 0.5, rotate: -90, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.5, rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
              >
                {isOpen ? <X size={18} /> : <MessageCircle size={18} />}
              </motion.span>
            </AnimatePresence>
          </span>
          <span className="support-chat-btn-label">{t('supportChat.chatShort')}</span>
          <span className="support-chat-btn-hint">{t('supportChat.chatWithUs')}</span>
          {chat.unreadCount > 0 && !isOpen && (
            <span className="support-chat-badge">{chat.unreadCount > 99 ? "99+" : chat.unreadCount}</span>
          )}
        </span>
      </button>

      {/* Popup */}
      <AnimatePresence onExitComplete={() => setView("welcome")}>
        {isOpen && (
            <motion.div
              className="support-chat-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeWidget}
            >
              <div className="support-chat-popup-wrap">
                <motion.div
                  className="support-chat-popup"
                  initial={isMobile ? { y: "100%" } : { opacity: 0, y: 16, scale: 0.96 }}
                  animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
                  exit={isMobile ? { y: "100%" } : { opacity: 0, y: 24, scale: 0.94 }}
                  transition={isMobile
                    ? { type: "tween", duration: 0.34, ease: [0.4, 0, 0.2, 1] }
                    : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }
                  }
                  onClick={(e) => e.stopPropagation()}
                >
              {/* Header */}
              <div className="support-chat-header">
                <div className="support-chat-header-left">
                  {view === "chat" && (
                    <button onClick={() => setView("chats")} className="support-chat-back-btn">
                      <ChevronLeft size={16} />
                    </button>
                  )}
                  {view === "chats" || view === "contact" || view === "signin" ? (
                    <button onClick={() => setView("welcome")} className="support-chat-back-btn">
                      <ChevronLeft size={16} />
                    </button>
                  ) : null}
                  <div className="support-chat-avatar">
                    {view === "chat" && activePhoto ? (
                      <img src={activePhoto} alt="" />
                    ) : (
                      <Headphones size={16} />
                    )}
                  </div>
                  <div className="support-chat-header-info">
                    <p className="support-chat-header-title">
                      {view === "chat" ? activeName : view === "chats" ? t('supportChat.myChats') : t('supportChat.adminSupport')}
                      {view === "chats" && chat.unreadCount > 0 && (
                        <span className="support-chat-header-count">{chat.unreadCount > 99 ? "99+" : chat.unreadCount}</span>
                      )}
                    </p>
                    <p className="support-chat-header-sub">
                      {view === "chat" ? (
                        <span className="support-chat-online">
                          <span className="support-chat-online-dot" />
                          {t('supportChat.online')}
                        </span>
                      ) : view === "chats" ? (
                        t('supportChat.typicalReply')
                      ) : (
                        t('supportChat.typicalReply')
                      )}
                    </p>
                  </div>
                </div>
                <button onClick={closeWidget} className="support-chat-close-btn">
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <AnimatePresence mode="popLayout">
                {view === "welcome" && (
                  <motion.div
                    key="welcome"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.18 }}
                    className="support-chat-body"
                  >
                    <div className="support-chat-welcome">
                      <div className="support-chat-welcome-icon">
                        <MessageCircle size={28} />
                      </div>
                      <h3 className="support-chat-welcome-title">{t('supportChat.welcomeTitle')}</h3>
                      <p className="support-chat-welcome-text">
                        {t('supportChat.welcomeText')}
                      </p>
                      <div className="support-chat-options">
                        <button
                          onClick={() => setView("contact")}
                          className="support-chat-option"
                        >
                          <div className="support-chat-option-icon">
                            <Phone size={16} />
                          </div>
                          <div className="support-chat-option-text">
                            <p className="support-chat-option-title">{t('supportChat.contactUs')}</p>
                            <p className="support-chat-option-sub">{t('supportChat.contactUsSub')}</p>
                          </div>
                          <ChevronRight size={16} className="support-chat-option-arrow" />
                        </button>
                        <button onClick={goChats} className="support-chat-option">
                          <div className="support-chat-option-icon">
                            <MessagesSquare size={16} />
                          </div>
                          <div className="support-chat-option-text">
                            <p className="support-chat-option-title">{t('supportChat.chatWithUs')}</p>
                            <p className="support-chat-option-sub">{t('supportChat.chatWithUsSub')}</p>
                          </div>
                          <ChevronRight size={16} className="support-chat-option-arrow" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {view === "signin" && (
                  <motion.div
                    key="signin"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.18 }}
                    className="support-chat-body"
                  >
                    <div className="support-chat-signin">
                      <div className="support-chat-welcome-icon">
                        <LogIn size={26} />
                      </div>
                      <h3 className="support-chat-welcome-title">{t('supportChat.signInToChat')}</h3>
                      <p className="support-chat-welcome-text">{t('supportChat.signInPrompt')}</p>
                      <button
                        className="support-chat-signin-btn"
                        onClick={() => onOpenAuth?.('signup')}
                      >
                        {t('supportChat.signIn')}
                      </button>
                    </div>
                  </motion.div>
                )}

                {view === "contact" && (
                  <motion.div
                    key="contact"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.18 }}
                    className="support-chat-body"
                  >
                    <div className="support-chat-contact">
                      <div className="support-chat-contact-header">
                        <div className="support-chat-contact-icon">
                          <Headphones size={24} />
                        </div>
                        <h3 className="support-chat-contact-title">{t('supportChat.getInTouch')}</h3>
                        <p className="support-chat-contact-text">
                          {t('supportChat.getInTouchSub')}
                        </p>
                      </div>
                      <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`} className="support-chat-contact-item">
                        <div className="support-chat-contact-item-icon call">
                          <Phone size={15} />
                        </div>
                        <div className="support-chat-contact-item-text">
                          <p className="support-chat-contact-item-label">{t('supportChat.callUs')}</p>
                          <p className="support-chat-contact-item-value">{SUPPORT_PHONE}</p>
                        </div>
                        <span className="support-chat-contact-item-action">{t('supportChat.call')}</span>
                      </a>
                      <a href={`mailto:${SUPPORT_EMAIL}`} className="support-chat-contact-item">
                        <div className="support-chat-contact-item-icon email">
                          <Mail size={15} />
                        </div>
                        <div className="support-chat-contact-item-text">
                          <p className="support-chat-contact-item-label">{t('supportChat.emailUs')}</p>
                          <p className="support-chat-contact-item-value">{SUPPORT_EMAIL}</p>
                        </div>
                        <span className="support-chat-contact-item-action">{t('supportChat.email')}</span>
                      </a>
                      <div className="support-chat-hours">
                        <div className="support-chat-hours-header">
                          <Clock size={14} />
                          <span>{t('supportChat.businessHours')}</span>
                        </div>
                        {SUPPORT_HOURS.map((item) => (
                          <div key={item.label} className="support-chat-hours-row">
                            <span>{item.label}</span>
                            <span className={item.value === "Closed" ? "support-chat-hours-closed" : ""}>
                              {item.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {view === "chats" && (
                  <motion.div
                    key="chats"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.18 }}
                    className="support-chat-body support-chat-body-chats"
                  >
                    <div className="support-chat-conv-list">
                      <button className="support-chat-conv-support" onClick={goSupportChat}>
                        <div className="support-chat-conv-avatar">
                          <Headphones size={16} />
                        </div>
                        <div className="support-chat-conv-info">
                          <p className="support-chat-conv-name">{t('supportChat.expeditionSupport')}</p>
                          <p className="support-chat-conv-preview">{t('supportChat.chatWithSupportSub')}</p>
                        </div>
                        <ChevronRight size={16} className="support-chat-conv-arrow" />
                      </button>

                      {conversations.length === 0 && (
                        <div className="support-chat-conv-empty">
                          <MessagesSquare size={28} className="support-chat-conv-empty-icon" />
                          <p>{t('supportChat.noConversations')}</p>
                          <span>{t('supportChat.noConversationsSub')}</span>
                        </div>
                      )}

                      {conversations.map((conv) => {
                        const otherUser = otherParticipant(conv, myUserId);
                        const name = otherUser?.name || conv.title || t('supportChat.expeditionSupport');
                        const last = conv.messages?.[0];
                        return (
                          <button
                            key={conv.id}
                            className="support-chat-conv-item"
                            onClick={() => goConversation(conv.id)}
                          >
                            <div className="support-chat-conv-avatar">
                              {otherUser?.photoURL ? <img src={otherUser.photoURL} alt="" /> : <MessageCircle size={16} />}
                            </div>
                            <div className="support-chat-conv-info">
                              <p className="support-chat-conv-name">{name}</p>
                              <p className="support-chat-conv-preview">
                                {last
                                  ? (last.attachmentUrl ? `📷 ${t('supportChat.imageAttachment')}` : last.content)
                                  : t('supportChat.startConversation')}
                              </p>
                            </div>
                            <div className="support-chat-conv-meta">
                              <span className="support-chat-conv-time">{timeAgo(conv.updatedAt)}</span>
                              {(conv.unreadCount ?? 0) > 0 && (
                                <span className="support-chat-conv-unread">
                                  {Math.min(conv.unreadCount ?? 0, 99)}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {view === "chat" && (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.18 }}
                    className="support-chat-body support-chat-body-chat"
                  >
                    <ChatThread
                      messages={activeMessages}
                      myUserId={myUserId}
                      statuses={chat.messageStatuses}
                      otherLastReadAt={otherLastReadAt}
                      isTyping={!!activeTypingUserId}
                      typingName={activeTypingName}
                      onSend={chat.sendMessage}
                      onLoadMore={() => chat.activeConversationId && chat.loadMore(chat.activeConversationId)}
                      hasMore={chat.activeConversationId ? chat.hasMore[chat.activeConversationId] : false}
                      onTyping={(v) => chat.activeConversationId && chat.setTyping(chat.activeConversationId, v)}
                      onUpload={uploadChatImage}
                      emptyText={t('supportChat.startConversation')}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              </motion.div>
              </div>
            </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
