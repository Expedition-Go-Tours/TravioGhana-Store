/**
 * Reusable chat thread: message bubbles (with status ticks), typing
 * indicator, pagination and the input bar. Used by the support widget and
 * the dashboard chat page; reuses the .support-chat-* styles.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CheckCheck, ImagePlus, Send } from 'lucide-react'
import type { ChatMessage, MessageStatus } from './types'

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
  emptyText?: string
  showLoader?: boolean
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function StatusTick({ status }: { status?: MessageStatus }) {
  if (!status || status === 'sending') {
    return <Check size={13} className="support-chat-msg-tick" />
  }
  const read = status === 'read'
  return (
    <CheckCheck
      size={14}
      className="support-chat-msg-tick"
      style={read ? { color: '#53bdeb' } : { color: '#a3b3bc' }}
    />
  )
}

export default function ChatThread({
  messages, myUserId, statuses, otherLastReadAt, isTyping, typingName,
  onSend, onLoadMore, hasMore, onTyping, onUpload, emptyText, showLoader,
}: ChatThreadProps) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [sendingAttachment, setSendingAttachment] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState<{ url: string; type: string } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const stickToBottomRef = useRef(true)

  // Track whether the user is near the bottom; auto-scroll only then.
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  useEffect(() => {
    if (stickToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, isTyping])

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
      <div className="support-chat-messages" onScroll={handleScroll}>
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
          // Live status wins; otherwise fall back to the other participant's
          // lastReadAt so history messages keep their read state after a
          // reload (no live events replay for old messages).
          const status: MessageStatus | undefined =
            statuses?.[msg.id] ??
            (otherLastReadAt && msg.createdAt <= otherLastReadAt ? 'read' : undefined)

          return (
            <div
              key={msg.id}
              className={`support-chat-msg ${own ? 'own' : 'other'} ${isFirstInGroup ? 'mt-2' : 'mt-0.5'}`}
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
                  <a href={msg.attachmentUrl} target="_blank" rel="noreferrer" className="support-chat-attachment">
                    <img src={msg.attachmentUrl} alt="" loading="lazy" />
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

        <div ref={messagesEndRef} />
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
              disabled={sendingAttachment}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus size={18} />
            </button>
          </>
        )}
        <textarea
          value={input}
          onChange={(e) => handleTypingChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('supportChat.typeMessage')}
          rows={1}
          className="support-chat-input"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() && !pendingAttachment}
          className="support-chat-send-btn"
        >
          <Send size={15} />
        </button>
      </div>
    </>
  )
}
