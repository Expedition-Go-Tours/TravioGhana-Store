/**
 * REST client for the backend chat API (/api/chat/*). Auth token is attached
 * automatically via fetchWithAuth; the socket (chatSocket.ts) handles
 * real-time delivery, this module is the durable/fallback path.
 */
import { fetchWithAuth } from '../lib/api'
import type { ChatConversation, ChatMessage, ConversationType } from './types'

interface ApiEnvelope<T> {
  status: string
  data: T
}

export async function getConversations(): Promise<ChatConversation[]> {
  const res = await fetchWithAuth('/chat/conversations')
  if (!res.ok) throw new Error(`Failed to load conversations (${res.status})`)
  const payload = (await res.json().catch(() => ({}))) as ApiEnvelope<{ conversations: ChatConversation[] }>
  return payload.data?.conversations ?? []
}

export async function getOrCreateConversation(
  recipientId: string,
  type: ConversationType,
): Promise<ChatConversation> {
  const res = await fetchWithAuth('/chat/conversations', {
    method: 'POST',
    body: JSON.stringify({ recipientId, type }),
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
  const res = await fetchWithAuth(`/chat/conversations/${conversationId}/messages?${params}`)
  if (!res.ok) throw new Error(`Failed to load messages (${res.status})`)
  const payload = (await res.json().catch(() => ({}))) as ApiEnvelope<MessagesPage>
  return payload.data
}

export async function sendMessageRest(
  conversationId: string,
  content: string,
  attachment?: { url: string; type: string } | null,
): Promise<ChatMessage> {
  const res = await fetchWithAuth(`/chat/conversations/${conversationId}/messages`, {
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

export async function markConversationAsRead(conversationId: string): Promise<void> {
  await fetchWithAuth(`/chat/conversations/${conversationId}/read`, { method: 'PATCH' })
}

export async function getUnreadCount(): Promise<number> {
  const res = await fetchWithAuth('/chat/conversations/unread-count')
  if (!res.ok) return 0
  const payload = (await res.json().catch(() => ({}))) as ApiEnvelope<{ unreadCount: number }>
  return payload.data?.unreadCount ?? 0
}

/** Shared support identity (the account all travelers reach for support). */
export async function getSupportUserId(): Promise<string | null> {
  const res = await fetchWithAuth('/chat/travioghana-support')
  if (!res.ok) return null
  const payload = (await res.json().catch(() => ({}))) as ApiEnvelope<{ expeditionId: string }>
  return payload.data?.expeditionId ?? null
}

export async function uploadChatImage(file: File): Promise<{ url: string; type: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetchWithAuth('/chat/upload', { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
  const payload = (await res.json().catch(() => ({}))) as ApiEnvelope<{ url: string; type: string }>
  return payload.data
}
