/**
 * REST client for the backend chat API. Auth token is attached automatically
 * via fetchWithAuth; the socket (chatSocket.ts) handles real-time delivery,
 * this module is the durable/fallback path.
 *
 * This storefront is served from the Ghana-scoped namespace
 * (/api/travioghana/chat → Ghana brand). The platform is resolved server-side
 * from the route, which is what keeps each brand's admin inbox isolated;
 * clients never have to (and must not) assert their own brand.
 */
import { fetchWithAuth } from '../lib/api'
import type { ChatConversation, ChatMessage, ConversationType } from './types'

const CHAT_BASE = '/travioghana/chat'

interface ApiEnvelope<T> {
  status: string
  data: T
}

export async function getConversations(): Promise<ChatConversation[]> {
  const res = await fetchWithAuth(`${CHAT_BASE}/conversations`)
  if (!res.ok) throw new Error(`Failed to load conversations (${res.status})`)
  const payload = (await res.json().catch(() => ({}))) as ApiEnvelope<{ conversations: ChatConversation[] }>
  return payload.data?.conversations ?? []
}

export interface ChatStartContext {
  /** id of the Booking this conversation is about (when started from one) */
  bookingId?: string
  /** booking.bookingNumber, e.g. EXP-12345678-2026-09 */
  bookingNumber?: string
  /** tour/experience title so emails show "About: <tour> · Ref <booking>" */
  tourTitle?: string
}

export async function getOrCreateConversation(
  recipientId: string,
  type: ConversationType,
  context?: ChatStartContext,
): Promise<ChatConversation> {
  const body: Record<string, unknown> = { recipientId, type }
  if (context) {
    if (context.bookingId) body.bookingId = context.bookingId
    if (context.bookingNumber) body.bookingNumber = context.bookingNumber
    if (context.tourTitle) body.tourTitle = context.tourTitle
  }
  const res = await fetchWithAuth(`${CHAT_BASE}/conversations`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload.message || `Failed to start conversation (${res.status})`)
  }
  const payload = (await res.json().catch(() => ({}))) as ApiEnvelope<{ conversation: ChatConversation }>
  return payload.data.conversation
}

export interface MessagesPage {
  messages: ChatMessage[]
  nextCursor: string | null
  hasMore: boolean
}

export async function getMessages(
  conversationId: string,
  cursor?: string | null,
  limit = 50,
): Promise<MessagesPage> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor) params.set('cursor', cursor)
  const res = await fetchWithAuth(`${CHAT_BASE}/conversations/${conversationId}/messages?${params}`)
  if (!res.ok) throw new Error(`Failed to load messages (${res.status})`)
  const payload = (await res.json().catch(() => ({}))) as ApiEnvelope<MessagesPage>
  return payload.data
}

export async function sendMessageRest(
  conversationId: string,
  content: string,
  attachment?: { url: string; type: string } | null,
): Promise<ChatMessage> {
  const res = await fetchWithAuth(`${CHAT_BASE}/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      ...(attachment ? { attachmentUrl: attachment.url, attachmentType: attachment.type } : {}),
    }),
  })
  if (!res.ok) throw new Error(`Failed to send message (${res.status})`)
  const payload = (await res.json().catch(() => ({}))) as ApiEnvelope<{ message: ChatMessage }>
  return payload.data.message
}

/**
 * "Delete for me": hide a message from the current user's own view only. The
 * other participant still sees it; the server keeps the row + attachment.
 */
export async function hideMessageForMe(conversationId: string, messageId: string): Promise<void> {
  const res = await fetchWithAuth(`${CHAT_BASE}/conversations/${conversationId}/messages/${messageId}/hide-for-me`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`Failed to delete message (${res.status})`)
}

export async function markConversationAsRead(conversationId: string): Promise<void> {
  await fetchWithAuth(`${CHAT_BASE}/conversations/${conversationId}/read`, { method: 'PATCH' })
}

export async function getUnreadCount(): Promise<number> {
  const res = await fetchWithAuth(`${CHAT_BASE}/conversations/unread-count`)
  if (!res.ok) return 0
  const payload = (await res.json().catch(() => ({}))) as ApiEnvelope<{ unreadCount: number }>
  return payload.data?.unreadCount ?? 0
}

/** Shared support identity — the account that answers storefront "Customer
 *  Support". Prefers the shared admin id (admin console "Customer Support"
 *  inbox); falls back to the expedition support identity so chat never breaks. */
export async function getSupportUserId(): Promise<string | null> {
  const res = await fetchWithAuth(`${CHAT_BASE}/admin-support`)
  if (res.ok) {
    const payload = (await res.json().catch(() => ({}))) as ApiEnvelope<{ adminId: string }>
    if (payload.data?.adminId) return payload.data.adminId
  }
  const fallback = await fetchWithAuth(`${CHAT_BASE}/expedition-support`)
  if (!fallback.ok) return null
  const payload = (await fallback.json().catch(() => ({}))) as ApiEnvelope<{ expeditionId: string }>
  return payload.data?.expeditionId ?? null
}

export async function uploadChatImage(file: File): Promise<{ url: string; type: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetchWithAuth(`${CHAT_BASE}/upload`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
  const payload = (await res.json().catch(() => ({}))) as ApiEnvelope<{ url: string; type: string }>
  return payload.data
}
