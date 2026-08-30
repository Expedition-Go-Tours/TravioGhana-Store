import type { ChatMessage } from './types'

/**
 * Replaces the optimistic (temp) copy of a message with its server-confirmed
 * copy. Guarantees the server message id appears at most once in the list no
 * matter how many confirmation events arrive (socket echo, emit ack, REST
 * fallback). No-op when the optimistic entry is already gone (late or
 * duplicate confirmation).
 */
export function mergeConfirmedMessage(
  messages: ChatMessage[],
  optimisticId: string,
  serverMessage: ChatMessage,
): ChatMessage[] {
  if (!messages.some((m) => m.id === optimisticId)) return messages
  return messages
    .filter((m) => m.id !== serverMessage.id)
    .map((m) => (m.id === optimisticId ? serverMessage : m))
}
