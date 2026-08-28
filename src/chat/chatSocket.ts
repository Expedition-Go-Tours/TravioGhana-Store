/**
 * Singleton socket.io client for the traveler chat. Connects with the
 * backend's access token (server io.use middleware verifies it), reconnects
 * with backoff, and drops the socket when the token is rejected so the
 * provider can refresh + reconnect.
 */
import { io, type Socket } from 'socket.io-client'
import { getApiBaseUrl } from '../lib/auth'

let socket: Socket | null = null

/** Derive the socket origin from the API base (…/api → origin). */
export function chatSocketUrl(): string {
  const base = getApiBaseUrl()
  return base.replace(/\/api\/?$/, '')
}

export function connectChatSocket(token: string): Socket {
  if (socket && socket.connected) return socket
  if (socket) {
    socket.disconnect()
    socket = null
  }
  socket = io(chatSocketUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 15000,
  })
  return socket
}

export function getChatSocket(): Socket | null {
  return socket
}

export function disconnectChatSocket(): void {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}
