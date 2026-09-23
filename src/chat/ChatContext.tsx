/**
 * Chat store for the traveler app: conversations, messages, typing/read/
 * delivered statuses and unread counts, backed by the backend chat API +
 * socket.io realtime. Shared by the support widget (homepage + tour detail),
 * the dashboard chat page and the dashboard notifications page.
 */
import {
  createContext, useContext, useEffect, useMemo, useRef, useState, useCallback, type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthUser } from '../hooks/useAuthUser'
import { getAuthToken, refreshAuthToken } from '../lib/auth'
import { queryClient } from '../lib/queryClient'
import * as api from './chatApi'
import type { ChatStartContext } from './chatApi'
import { connectChatSocket, disconnectChatSocket, getChatSocket } from './chatSocket'
import type {
  ChatConversation, ChatMessage, ChatRecipient, ConversationType, MessageStatus,
} from './types'
import { SUPPLIER_CONVERSATION_TYPE, SUPPORT_CONVERSATION_TYPE } from './types'

interface ChatContextValue {
  conversations: ChatConversation[]
  activeConversationId: string | null
  messages: Record<string, ChatMessage[]>
  hasMore: Record<string, boolean>
  typingUserId: Record<string, string | null>
  messageStatuses: Record<string, MessageStatus>
  unreadCount: number
  openConversation: (conversationId: string) => void
  startChat: (
    recipient: ChatRecipient,
    type: ConversationType,
    context?: ChatStartContext,
  ) => Promise<ChatConversation>
  openSupplierChat: (supplier: ChatRecipient, context?: ChatStartContext) => Promise<void>
  openSupportChat: () => Promise<void>
  closeConversation: () => void
  sendMessage: (content: string, attachment?: { url: string; type: string }) => void
  hideMessageForMe: (conversationId: string, messageId: string) => Promise<void>
  loadMore: (conversationId: string) => void
  setTyping: (conversationId: string, isTyping: boolean) => void
  refreshConversations: () => Promise<void>
}

const ChatContext = createContext<ChatContextValue | null>(null)

/** The other participant of a 1-on-1 conversation from the current user's view. */
export function otherParticipant(conversation: ChatConversation, myUserId: string | undefined) {
  const other = conversation.participants?.find((p) => p.userId !== myUserId)
  return other?.user
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}

let optimisticSeq = 0
function tempMessageId(): string {
  optimisticSeq += 1
  return `tmp-${Date.now()}-${optimisticSeq}`
}

/** Chronological (oldest → newest) ordering for a thread, regardless of the
 *  order the backend returns — keeps the newest message at the bottom. */
function sortByCreatedAtAsc(list: ChatMessage[]): ChatMessage[] {
  return [...list].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const user = useAuthUser()
  const userId = user?.id || user?._id || user?.uid || undefined

  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({})
  const [hasMore, setHasMore] = useState<Record<string, boolean>>({})
  const [typingUserId, setTypingUserId] = useState<Record<string, string | null>>({})
  const [messageStatuses, setMessageStatuses] = useState<Record<string, MessageStatus>>({})
  const [unreadCount, setUnreadCount] = useState(0)

  const activeRef = useRef<string | null>(null)
  const userIdRef = useRef(userId)
  const typingThrottleRef = useRef<Record<string, number>>({})
  // Tracks in-flight history loads so a failed fetch is retried on the next
  // open instead of leaving the thread permanently empty.
  const messageLoadsInFlight = useRef<Record<string, boolean>>({})
  const messagesRef = useRef<Record<string, ChatMessage[]>>({})
  // Throttle "mark read": socket receipt + REST ack can otherwise fire rapid
  // duplicate PATCHes to /chat/conversations/:id/read while a thread is open.
  const lastMarkedAtRef = useRef<Record<string, number>>({})
  const markConversationRead = useCallback((conversationId: string) => {
    const now = Date.now()
    if (now - (lastMarkedAtRef.current[conversationId] ?? 0) < 1500) return
    lastMarkedAtRef.current[conversationId] = now
    getChatSocket()?.emit('chat:mark-read', { conversationId })
    api.markConversationAsRead(conversationId).catch(() => {})
  }, [])

  useEffect(() => {
    activeRef.current = activeConversationId
  }, [activeConversationId])
  useEffect(() => {
    userIdRef.current = userId
  }, [userId])
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Sign-out: clear local chat state. Render-phase adjustment, guarded so it
  // only fires on the signed-in → signed-out transition.
  const [prevUser, setPrevUser] = useState(user)
  if (user !== prevUser) {
    setPrevUser(user)
    if (!user) {
      setConversations([])
      setMessages({})
      setActiveConversationId(null)
      setUnreadCount(0)
    }
  }

  const refreshConversations = useCallback(async () => {
    try {
      const list = await api.getConversations()
      setConversations(list)
      const unread = list.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0)
      setUnreadCount(unread)
    } catch {
      /* transient — retried on next socket event / manual refresh */
    }
  }, [])

  // ── Socket event handlers (stable — attached at connect time) ────────
  const handleSocketMessage = useCallback(
    (payload: { conversationId: string; message: ChatMessage }) => {
      const { conversationId, message } = payload
      if (!conversationId || !message?.id) return
      const mine = message.senderId === userIdRef.current
      const active = activeRef.current === conversationId

      setMessages((prev) => {
        const list = prev[conversationId] ?? []
        if (list.some((m) => m.id === message.id)) return prev
        return { ...prev, [conversationId]: [...list, message] }
      })
      if (!mine) {
        setConversations((prev) => {
          const existing = prev.find((c) => c.id === conversationId)
          if (existing) {
            return prev.map((c) => {
              if (c.id !== conversationId) return c
              const delta = active ? -Math.min(c.unreadCount ?? 0, 1) : 1
              return { ...c, unreadCount: Math.max(0, (c.unreadCount ?? 0) + delta), updatedAt: message.createdAt }
            })
          }
          refreshConversations()
          return prev
        })
        setUnreadCount((prev) => (active ? prev : prev + 1))
        if (active) {
          // Auto mark-read while the conversation is open (throttled).
          markConversationRead(conversationId)
        } else {
          refreshConversations()
        }
      }
    },
    [refreshConversations, markConversationRead],
  )

  const handleSocketTyping = useCallback(
    (payload: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (payload.userId === userIdRef.current) return
      setTypingUserId((prev) => ({
        ...prev,
        [payload.conversationId]: payload.isTyping ? payload.userId : null,
      }))
    },
    [],
  )

  const handleSocketMarkRead = useCallback(
    (payload: { conversationId: string; readBy: string }) => {
      if (payload.readBy === userIdRef.current) return
      // Only this conversation's messages become read.
      const convIds = new Set((messagesRef.current[payload.conversationId] ?? []).map((m) => m.id))
      setMessageStatuses((prev) => {
        const next = { ...prev }
        for (const id of Object.keys(next)) {
          if (convIds.has(id) && next[id] !== 'read') next[id] = 'read'
        }
        return next
      })
      setConversations((prev) =>
        prev.map((c) => (c.id === payload.conversationId ? { ...c, unreadCount: 0 } : c)),
      )
    },
    [],
  )

  const handleSocketDelivered = useCallback(
    (payload: { conversationId: string; messageIds: string[] }) => {
      setMessageStatuses((prev) => {
        const next = { ...prev }
        for (const id of payload.messageIds ?? []) {
          if (next[id] === 'sending' || next[id] === 'sent') next[id] = 'delivered'
        }
        return next
      })
    },
    [],
  )

  const handleSocketEdited = useCallback(
    (payload: { conversationId: string; messageId: string; content: string; editedAt: string }) => {
      setMessages((prev) => {
        const list = prev[payload.conversationId]
        if (!list) return prev
        return {
          ...prev,
          [payload.conversationId]: list.map((m) =>
            m.id === payload.messageId ? { ...m, content: payload.content, editedAt: payload.editedAt } : m,
          ),
        }
      })
    },
    [],
  )

  const handleSocketDeleted = useCallback(
    (payload: { conversationId: string; messageId: string }) => {
      setMessages((prev) => ({
        ...prev,
        [payload.conversationId]: (prev[payload.conversationId] ?? []).filter(
          (m) => m.id !== payload.messageId,
        ),
      }))
    },
    [],
  )

  // ── Auth lifecycle: connect socket, attach listeners + hydrate ───────
  useEffect(() => {
    if (!user) {
      disconnectChatSocket()
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAuthToken()
        if (!token || cancelled) return
        const socket = connectChatSocket(token)

        socket.on('auth:expired', () => {
          // One refresh attempt, then reconnect; otherwise the user must
          // sign in again.
          disconnectChatSocket()
          refreshAuthToken()
            .then(async (ok) => {
              if (!ok) return
              const fresh = await getAuthToken()
              if (fresh) connectChatSocket(fresh)
            })
            .catch(() => {})
        })
        // Reconnect: rooms are lost, so rejoin the active conversation and
        // re-hydrate the conversation list.
        socket.on('connect', () => {
          if (activeRef.current) socket.emit('chat:join', { conversationId: activeRef.current })
          refreshConversations()
        })
        socket.on('chat:message', handleSocketMessage)
        socket.on('chat:typing', handleSocketTyping)
        socket.on('chat:mark-read', handleSocketMarkRead)
        socket.on('chat:delivered', handleSocketDelivered)
        socket.on('chat:message-edited', handleSocketEdited)
        socket.on('chat:message-deleted', handleSocketDeleted)
        socket.on('chat:message-deleted-for-me', handleSocketDeleted)

        // Real-time badge: the backend pushes user notifications (Socket.IO
        // room `user:{id}`) when a booking is confirmed. Refreshing the
        // bookings queries here makes the navbar badge appear instantly on any
        // open tab/device; the count query's 60s poll is the fallback.
        socket.on('notification', (payload: { type?: string } | undefined) => {
          const type = payload?.type
          if (type === 'BOOKING_CONFIRMED' || type === 'BOOKING_AWAITING_CONFIRMATION') {
            queryClient.invalidateQueries({ queryKey: ['expedition', 'bookings'] })
          }
        })

        await refreshConversations()
      } catch {
        /* transient */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    user, refreshConversations, handleSocketMessage, handleSocketTyping,
    handleSocketMarkRead, handleSocketDelivered, handleSocketEdited, handleSocketDeleted,
  ])

  // ── Realtime fallback: lightweight polling so supplier replies appear
  //    without a page refresh even when socket pushes are missed ────────
  const threadPollInFlightRef = useRef(false)

  const pollActiveThread = useCallback(async () => {
    const convId = activeRef.current
    if (!convId || threadPollInFlightRef.current) return
    threadPollInFlightRef.current = true
    try {
      const page = await api.getMessages(convId)
      setMessages((prev) => {
        const existing = prev[convId] ?? []
        const known = new Set(existing.map((m) => m.id))
        const fresh = page.messages.filter((m) => !known.has(m.id))
        if (fresh.length === 0) return prev
        return { ...prev, [convId]: sortByCreatedAtAsc([...existing, ...fresh]) }
      })
      setHasMore((prev) => ({ ...prev, [convId]: page.hasMore }))
    } catch {
      /* transient */
    } finally {
      threadPollInFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!user) return
    const listTimer = setInterval(() => {
      if (!document.hidden) refreshConversations()
    }, 15000)
    const threadTimer = setInterval(() => {
      if (!document.hidden) void pollActiveThread()
    }, 8000)
    const refetch = () => {
      refreshConversations()
      void pollActiveThread()
    }
    window.addEventListener('focus', refetch)
    document.addEventListener('visibilitychange', refetch)
    return () => {
      clearInterval(listTimer)
      clearInterval(threadTimer)
      window.removeEventListener('focus', refetch)
      document.removeEventListener('visibilitychange', refetch)
    }
  }, [user, refreshConversations, pollActiveThread])

  // ── Conversation actions ─────────────────────────────────────────────
  const openConversation = useCallback(
    (conversationId: string) => {
      if (activeRef.current && activeRef.current !== conversationId) {
        getChatSocket()?.emit('chat:leave', { conversationId: activeRef.current })
      }
      setActiveConversationId(conversationId)
      getChatSocket()?.emit('chat:join', { conversationId })
      setTypingUserId((prev) => ({ ...prev, [conversationId]: null }))

      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
      )
      setUnreadCount((prev) => {
        const conv = conversations.find((c) => c.id === conversationId)
        return Math.max(0, prev - (conv?.unreadCount ?? 0))
      })

      if (!messages[conversationId] && !messageLoadsInFlight.current[conversationId]) {
        messageLoadsInFlight.current[conversationId] = true
        api
          .getMessages(conversationId)
          .then((page) => {
            setMessages((prev) => ({ ...prev, [conversationId]: sortByCreatedAtAsc(page.messages) }))
            setHasMore((prev) => ({ ...prev, [conversationId]: page.hasMore }))
          })
          .catch(() => {})
          .finally(() => {
            delete messageLoadsInFlight.current[conversationId]
          })
      }
      markConversationRead(conversationId)
    },
    [conversations, messages, markConversationRead],
  )

  /** Finds-or-creates a conversation with a recipient and opens it. Throws on
   *  failure so callers can surface/fall back. `context` attaches the booking a
   *  booking-originated chat is about (used by messaging emails). */
  const startChat = useCallback(
    async (
      recipient: ChatRecipient,
      type: ConversationType,
      context?: ChatStartContext,
    ): Promise<ChatConversation> => {
      const conv = await api.getOrCreateConversation(recipient.id, type, context)
      setConversations((prev) => {
        if (prev.some((c) => c.id === conv.id)) return prev
        return [conv, ...prev]
      })
      openConversation(conv.id)
      return conv
    },
    [openConversation],
  )

  const openSupplierChat = useCallback(
    async (supplier: ChatRecipient, context?: ChatStartContext) => {
      await startChat(supplier, SUPPLIER_CONVERSATION_TYPE, context)
    },
    [startChat],
  )

  const openSupportChat = useCallback(async () => {
    const supportId = await api.getSupportUserId()
    if (!supportId) {
      throw new Error('support_unavailable')
    }
    // Reuse an existing admin Customer Support (USER_SUPPORT) thread so support
    // never spawns a duplicate; fall back to the most recently updated thread
    // with this identity if a legacy one exists. Prefer the thread with history.
    const existing = conversations
      .filter((c) => {
        const isSupport = c.type === SUPPORT_CONVERSATION_TYPE
        const hasSupportParticipant = c.participants?.some((p) => p.userId === supportId)
        return isSupport || (hasSupportParticipant && c.type === 'EXPEDITION_CUSTOMER')
      })
      .sort((a, b) => {
        const aHas = (a.messages?.length ?? 0) > 0 ? 1 : 0
        const bHas = (b.messages?.length ?? 0) > 0 ? 1 : 0
        if (aHas !== bHas) return bHas - aHas
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })[0]
    if (existing) {
      openConversation(existing.id)
      return
    }
    await startChat(
      { id: supportId, name: t('supportChat.customerSupport') },
      SUPPORT_CONVERSATION_TYPE,
    )
  }, [conversations, openConversation, startChat, t])

  const closeConversation = useCallback(() => {
    if (activeRef.current) {
      getChatSocket()?.emit('chat:leave', { conversationId: activeRef.current })
    }
    setActiveConversationId(null)
  }, [])

  const sendMessage = useCallback(
    (content: string, attachment?: { url: string; type: string }) => {
      const conversationId = activeRef.current
      if (!conversationId) return
      const optimisticId = tempMessageId()
      const optimistic: ChatMessage = {
        id: optimisticId,
        conversationId,
        senderId: userIdRef.current ?? '',
        content,
        attachmentUrl: attachment?.url ?? null,
        attachmentType: attachment?.type ?? null,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] ?? []), optimistic],
      }))
      setMessageStatuses((prev) => ({ ...prev, [optimisticId]: 'sending' }))

      const replaceOptimistic = (serverMessage: ChatMessage) => {
        setMessages((prev) => {
          const list = prev[conversationId] ?? []
          // Idempotent: drop the temp AND any copy of the server message the
          // socket echo may have inserted before the ack arrived, then append
          // the server message exactly once — otherwise the echo+ack race
          // renders the same message twice.
          const rest = list.filter(
            (m) => m.id !== optimisticId && m.id !== serverMessage.id,
          )
          return { ...prev, [conversationId]: [...rest, serverMessage] }
        })
        setMessageStatuses((prev) => {
          const next = { ...prev }
          delete next[optimisticId]
          return next
        })
      }

      const socket = getChatSocket()
      const sendViaSocket = socket && socket.connected
      const fallbackRest = () => {
        // The socket send may have landed even though the ack was lost — the
        // server broadcasts the sender's own message back, so if an identical
        // message from me just arrived, reuse it instead of POSTing again.
        const list = messagesRef.current[conversationId] ?? []
        const echoed = list.find(
          (m) =>
            m.id !== optimisticId &&
            m.senderId === userIdRef.current &&
            m.content === content &&
            (m.attachmentUrl ?? null) === (attachment?.url ?? null) &&
            Date.now() - new Date(m.createdAt).getTime() < 15000,
        )
        if (echoed) {
          replaceOptimistic(echoed)
          return
        }
        api
          .sendMessageRest(conversationId, content, attachment)
          .then((serverMessage) => {
            replaceOptimistic(serverMessage)
            setMessageStatuses((prev) => ({ ...prev, [serverMessage.id]: 'sent' }))
          })
          .catch(() => {
            setMessageStatuses((prev) => ({ ...prev, [optimisticId]: 'sent' }))
          })
      }
      if (sendViaSocket) {
        const timer = setTimeout(() => {
          // Ack lost — fall back to REST so the message is never dropped.
          fallbackRest()
        }, 8000)
        socket.emit(
          'chat:message',
          {
            conversationId,
            content,
            ...(attachment ? { attachmentUrl: attachment.url, attachmentType: attachment.type } : {}),
          },
          (ack?: { status: string; data?: { message?: ChatMessage } }) => {
            clearTimeout(timer)
            if (ack?.status === 'success' && ack.data?.message) {
              replaceOptimistic(ack.data.message)
              setMessageStatuses((prev) => ({ ...prev, [ack.data!.message!.id]: 'sent' }))
            } else if (ack?.status === 'error') {
              fallbackRest()
            }
          },
        )
      } else {
        fallbackRest()
      }
    },
    [],
  )

  /**
   * "Delete for me": hide a message the current user sent from their own view
   * only. Optimistic local removal, rolled back if the server call fails. The
   * other participant keeps the message (no conversation-room broadcast).
   */
  const hideMessageForMe = useCallback(
    async (conversationId: string, messageId: string) => {
      const list = messagesRef.current[conversationId] ?? []
      if (!list.some((m) => m.id === messageId)) return
      // Optimistic removal — restore on failure.
      setMessages((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).filter((m) => m.id !== messageId),
      }))
      setMessageStatuses((prev) => {
        const next = { ...prev }
        delete next[messageId]
        return next
      })
      try {
        await api.hideMessageForMe(conversationId, messageId)
      } catch {
        // Server said no (or it failed) — bring the message back.
        setMessages((prev) => {
          const existing = prev[conversationId] ?? []
          if (existing.some((m) => m.id === messageId)) return prev
          const original = list.find((m) => m.id === messageId)
          if (!original) return prev
          return { ...prev, [conversationId]: sortByCreatedAtAsc([...existing, original]) }
        })
      }
    },
    [],
  )

  const loadMore = useCallback((conversationId: string) => {
    if (!hasMore[conversationId]) return
    const list = messages[conversationId]
    const cursor = list && list.length > 0 ? list[0].createdAt : undefined
    api
      .getMessages(conversationId, cursor)
      .then((page) => {
        setMessages((prev) => {
          const existing = prev[conversationId] ?? []
          const known = new Set(existing.map((m) => m.id))
          const fresh = page.messages.filter((m) => !known.has(m.id))
          return { ...prev, [conversationId]: sortByCreatedAtAsc([...fresh, ...existing]) }
        })
        setHasMore((prev) => ({ ...prev, [conversationId]: page.hasMore }))
      })
      .catch(() => {})
  }, [hasMore, messages])

  const setTyping = useCallback((conversationId: string, isTyping: boolean) => {
    const socket = getChatSocket()
    if (!socket || !socket.connected) return
    const last = typingThrottleRef.current[conversationId] ?? 0
    const now = Date.now()
    if (isTyping && now - last < 2000) return
    typingThrottleRef.current[conversationId] = now
    socket.emit('chat:typing', { conversationId, isTyping })
  }, [])

  const value = useMemo<ChatContextValue>(
    () => ({
      conversations,
      activeConversationId,
      messages,
      hasMore,
      typingUserId,
      messageStatuses,
      unreadCount,
      openConversation,
      startChat,
      openSupplierChat,
      openSupportChat,
      closeConversation,
      sendMessage,
      hideMessageForMe,
      loadMore,
      setTyping,
      refreshConversations,
    }),
    [
      conversations, activeConversationId, messages, hasMore, typingUserId,
      messageStatuses, unreadCount, openConversation, startChat, openSupplierChat, openSupportChat,
      closeConversation, sendMessage, hideMessageForMe, loadMore, setTyping, refreshConversations,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
