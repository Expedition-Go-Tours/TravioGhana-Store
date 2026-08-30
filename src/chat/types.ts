/** Backend ConversationType enum (prisma). */
export type ConversationType = 'SUPPLIER_CUSTOMER' | 'SUPPLIER_ADMIN' | 'USER_SUPPORT' | 'EXPEDITION_CUSTOMER'

/** Minimal user projection attached to conversations/messages. */
export interface ChatUser {
  id: string
  name: string | null
  photoURL: string | null
  lastLoginAt?: string | null
  firebaseUid?: string | null
  roles?: string[]
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  content: string
  attachmentUrl?: string | null
  attachmentType?: string | null
  editedAt?: string | null
  createdAt: string
  sender?: ChatUser
}

export interface ConversationParticipant {
  id: string
  userId: string
  lastReadAt: string
  joinedAt?: string
  user: ChatUser
}

export interface ChatConversation {
  id: string
  type: ConversationType
  title?: string | null
  createdAt: string
  updatedAt: string
  participants: ConversationParticipant[]
  messages?: ChatMessage[]
  unreadCount?: number
  lastReadAt?: string
}

export interface ChatRecipient {
  id: string
  name?: string | null
  photoURL?: string | null
}

/** Delivery status of one of the current user's own messages. */
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read'

export const SUPPORT_CONVERSATION_TYPE: ConversationType = 'EXPEDITION_CUSTOMER'
export const SUPPLIER_CONVERSATION_TYPE: ConversationType = 'SUPPLIER_CUSTOMER'
