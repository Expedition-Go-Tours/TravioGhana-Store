/**
 * Reusable chat thread: message bubbles (with status ticks), typing
 * indicator, pagination and the input bar. Used by the dashboard chat page;
 * owns the shared .support-chat-* / .dash-chat-* stylesheet.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, Check, CheckCheck, ImagePlus, Send, Trash2 } from 'lucide-react'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import type { ChatMessage, MessageStatus } from './types'
import './ChatThread.css'

interface ChatThreadProps {
  messages: ChatMessage[]
  myUserId?: string
  statuses?: Record<string, MessageStatus>
  /** When the other participant last read the conversation — used to show
      read ticks for history messages that have no live status yet. */
  otherLastReadAt?: string | null
  isTyping?: boolean
  typingName?: string | null
  onSend: (content: string, attachment?: { url: string; type: string }) => void
  onLoadMore?: () => void
  hasMore?: boolean
  onTyping?: (isTyping: boolean) => void
  onUpload?: (file: File) => Promise<{ url: string; type: string }>
  /** When true, own messages get a "delete for me" control. */
  allowDelete?: boolean
  onDeleteMessage?: (messageId: string) => void | Promise<void>
  emptyText?: string
  showLoader?: boolean
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Format a date for the in-thread separator labels */
function formatDateLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  if (isToday) return 'Today'
  if (isYesterday) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Check if two dates are on the same day */
function sameDay(a: string, b: string): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getDate() === db.getDate() &&
    da.getMonth() === db.getMonth() &&
    da.getFullYear() === db.getFullYear()
  )
}

function StatusTick({ status }: { status?: MessageStatus }) {
  if (!status || status === 'sending') {
    return <Check size={13} className="support-chat-msg-tick" aria-label="Sending" />
  }
  if (status === 'sent') {
    return <Check size={13} className="support-chat-msg-tick" aria-label="Sent" />
  }
  if (status === 'delivered') {
    return <CheckCheck size={14} className="support-chat-msg-tick" aria-label="Delivered" />
  }
  // read
  return <CheckCheck size={14} className="support-chat-msg-tick read-tick" aria-label="Read" />
}

export default function ChatThread({
  messages, myUserId, statuses, otherLastReadAt, isTyping, typingName,
  onSend, onLoadMore, hasMore, onTyping, onUpload, emptyText, showLoader,
  allowDelete = false, onDeleteMessage,
}: ChatThreadProps) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [sendingAttachment, setSendingAttachment] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState<{ url: string; type: string } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stickToBottomRef = useRef(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [showScrollFab, setShowScrollFab] = useState(false)

  // Auto-grow the composer as the message gets longer so the text stays
  // visible instead of overflowing into a scrollbar (max-height caps growth).
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  // Track whether the user is near the bottom; auto-scroll only then.
  // Also control the scroll-to-bottom FAB visibility.
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottomRef.current = distFromBottom < 120
    setShowScrollFab(distFromBottom > 300)
  }

  // Scroll the message list only — never the page. `scrollIntoView` on an
  // element would also scroll ancestor containers (including the document),
  // which on the dashboard makes the whole chat card jump when a thread opens.
  const scrollMessagesToBottom = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (stickToBottomRef.current) {
      scrollMessagesToBottom()
    }
  }, [messages.length, isTyping, scrollMessagesToBottom])

  const scrollToBottom = () => {
    scrollMessagesToBottom()
    stickToBottomRef.current = true
    setShowScrollFab(false)
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    setDeletingId(pendingDeleteId)
    const id = pendingDeleteId
    setPendingDeleteId(null)
    try {
      await onDeleteMessage?.(id)
    } finally {
      setDeletingId(null)
    }
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text && !pendingAttachment) return
    onSend(text || '', pendingAttachment ?? undefined)
    setInput('')
    setPendingAttachment(null)
    setPreviewUrl(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const pickFile = async (file: File | undefined) => {
    if (!file || !onUpload) return
    setSendingAttachment(true)
    try {
      const uploaded = await onUpload(file)
      setPendingAttachment(uploaded)
      setPreviewUrl(URL.createObjectURL(file))
    } catch {
      /* upload failed — ignore */
    } finally {
      setSendingAttachment(false)
    }
  }

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleTypingChange = (value: string) => {
    setInput(value)
    if (!onTyping) return
    if (typingTimer.current) clearTimeout(typingTimer.current)
    onTyping(true)
    typingTimer.current = setTimeout(() => onTyping(false), 2500)
  }

  return (
    <>
      <div
        className="support-chat-messages"
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{ position: 'relative' }}
      >
        {hasMore && (
          <div className="support-chat-load-more-wrap">
            <button type="button" className="support-chat-load-more" onClick={onLoadMore} disabled={showLoader}>
              {showLoader ? t('supportChat.loading') : t('supportChat.loadOlder')}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <p className="support-chat-empty">{emptyText ?? t('supportChat.startConversation')}</p>
        )}

        {messages.map((msg, idx) => {
          const prev = messages[idx - 1]
          const next = messages[idx + 1]
          const own = msg.senderId === myUserId
          const isFirstInGroup = !prev || prev.senderId !== msg.senderId
          const isLastInGroup = !next || next.senderId !== msg.senderId
          const isGrouped = prev && prev.senderId === msg.senderId
          const showDateSep = !prev || !sameDay(prev.createdAt, msg.createdAt)
          // Live status wins; otherwise fall back to the other participant's
          // lastReadAt so history messages keep their read state after a
          // reload (no live events replay for old messages).
          const status: MessageStatus | undefined =
            statuses?.[msg.id] ??
            (otherLastReadAt && msg.createdAt <= otherLastReadAt ? 'read' : undefined)

          return (
            <div key={msg.id}>
              {/* Date separator */}
              {showDateSep && (
                <div className="dash-chat-date-sep">
                  <span>{formatDateLabel(msg.createdAt)}</span>
                </div>
              )}

              <div
                className={`support-chat-msg ${own ? 'own' : 'other'} ${
                  isGrouped ? 'mt-0.5' : 'mt-2'
                } ${isGrouped && isLastInGroup ? 'dash-chat-msg-group-last' : ''} ${
                  isGrouped && isFirstInGroup ? 'dash-chat-msg-group-first' : ''
                }`}
              >
                <div
                  className={`support-chat-bubble ${own ? 'own' : 'other'} ${
                    isFirstInGroup && isLastInGroup
                      ? 'rounded-lg'
                      : isFirstInGroup
                        ? own ? 'rounded-t-lg rounded-bl-lg rounded-br-sm' : 'rounded-t-lg rounded-br-lg rounded-bl-sm'
                        : isLastInGroup
                          ? own ? 'rounded-lg rounded-br-sm' : 'rounded-lg rounded-bl-sm'
                          : own ? 'rounded-lg rounded-br-sm rounded-bl-lg' : 'rounded-lg rounded-bl-sm rounded-br-lg'
                  }`}
                >
                  {msg.attachmentUrl && (
                    <a href={msg.attachmentUrl} target="_blank" rel="noreferrer" className="support-chat-attachment dash-chat-bubble-image">
                      <img src={msg.attachmentUrl} alt={t('supportChat.imageAttachment', 'Photo')} loading="lazy" />
                    </a>
                  )}
                  {msg.content && <div className={isLastInGroup ? 'pb-0.5' : ''}>{msg.content}</div>}
                  {isLastInGroup && (
                    <p className={`support-chat-msg-time ${own ? 'own' : 'other'}`}>
                      {formatTime(msg.createdAt)}
                      {own && <StatusTick status={status} />}
                    </p>
                  )}
                </div>
                {own && allowDelete && onDeleteMessage && (
                  <button
                    type="button"
                    className="support-chat-delete"
                    aria-label={t('supportChat.deleteForMe', 'Delete for me')}
                    title={t('supportChat.deleteForMe', 'Delete for me')}
                    disabled={deletingId === msg.id}
                    onClick={() => setPendingDeleteId(msg.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          )
        })}

        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="support-chat-msg other mt-2"
            >
              <div className="support-chat-bubble other rounded-lg rounded-bl-sm support-chat-typing">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="support-chat-typing-dot"
                    animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
                  />
                ))}
                {typingName && <span className="support-chat-typing-name">{typingName}</span>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scroll-to-bottom FAB */}
        <AnimatePresence>
          {showScrollFab && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="dash-chat-scroll-fab"
              onClick={scrollToBottom}
              aria-label={t('supportChat.scrollToBottom', 'Scroll to latest')}
              type="button"
            >
              <ArrowDown size={18} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="support-chat-input-bar">
        {previewUrl && (
          <div className="support-chat-attachment-preview">
            <img src={previewUrl} alt="" />
            <button
              type="button"
              aria-label={t('supportChat.removeAttachment')}
              onClick={() => {
                setPendingAttachment(null)
                setPreviewUrl(null)
                if (fileRef.current) fileRef.current.value = ''
              }}
            >
              ×
            </button>
          </div>
        )}
        {onUpload && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <button
              type="button"
              className="support-chat-attach-btn"
              aria-label={t('supportChat.attachImage')}
              title={t('supportChat.attachImage', 'Attach image')}
              disabled={sendingAttachment}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus size={18} />
            </button>
          </>
        )}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => handleTypingChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('supportChat.typeMessage')}
          rows={1}
          className="support-chat-input"
          aria-label={t('supportChat.typeMessage', 'Type a message')}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() && !pendingAttachment}
          className="support-chat-send-btn"
          aria-label={t('supportChat.send', 'Send')}
          title={t('supportChat.send', 'Send')}
        >
          <Send size={16} />
        </button>
      </div>

      <ConfirmDialog
        open={!!pendingDeleteId}
        title={t('supportChat.deleteForMeTitle', 'Delete message?')}
        message={t(
          'supportChat.deleteForMeConfirm',
          'This message will be deleted for you only. The other person will still see it.',
        )}
        confirmLabel={t('supportChat.deleteForMe', 'Delete for me')}
        cancelLabel={t('common.cancel', 'Cancel')}
        tone="danger"
        onConfirm={confirmDelete}
        onClose={() => setPendingDeleteId(null)}
      />
    </>
  )
}
