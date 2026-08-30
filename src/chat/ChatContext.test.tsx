import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, screen, cleanup } from '@testing-library/react'
import { ChatProvider, useChat } from './ChatContext'
import type { ChatMessage } from './types'

/**
 * Fake socket.io client. Records handlers/acks so the test can replay the
 * server-side behavior: broadcast the sender's own message back to the room
 * ('chat:message' echo) and invoke the emit ack callback.
 */
const { socketMock } = vi.hoisted(() => {
  const handlers: Record<string, Array<(payload: unknown) => void>> = {}
  const acks: Record<string, Array<(ack?: unknown) => void>> = {}
  const socket = {
    connected: true,
    on: vi.fn((ev: string, cb: (_payload: unknown) => void) => {
      ;(handlers[ev] ??= []).push(cb)
    }),
    emit: vi.fn((ev: string, _payload: unknown, ack?: (a?: unknown) => void) => {
      if (ack) (acks[ev] ??= []).push(ack)
      return true
    }),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
    _emitEvent: (ev: string, payload: unknown) => {
      ;(handlers[ev] ?? []).forEach((cb) => cb(payload))
    },
    _ack: (ev: string, ...args: unknown[]) => {
      ;(acks[ev] ?? []).forEach((cb) => cb(...(args as [unknown])))
    },
    _emitCalls: (ev: string) => socket.emit.mock.calls.filter((c) => c[0] === ev),
  }
  return { socketMock: socket }
})

vi.mock('socket.io-client', () => ({ io: () => socketMock }))

const authUser = { id: 'user-1', name: 'Test User', email: 'test@example.com' }

vi.mock('../lib/auth', () => ({
  getStoredAuthUser: () => authUser,
  subscribeToAuthState: (cb: (u: unknown) => void) => {
    cb(authUser)
    return Promise.resolve(() => {})
  },
  getAuthToken: async () => 'token',
  refreshAuthToken: async () => null,
  getApiBaseUrl: () => 'http://test/api',
}))

const { sendMessageRestMock } = vi.hoisted(() => ({
  sendMessageRestMock: vi.fn(async () => ({
    id: 'm2',
    conversationId: 'conv-1',
    senderId: 'user-1',
    content: 'hello world',
    createdAt: '2026-08-30T10:00:00.000Z',
  })),
}))

vi.mock('./chatApi', () => ({
  getConversations: vi.fn(async () => []),
  getMessages: vi.fn(async () => ({ messages: [], nextCursor: null, hasMore: false })),
  getOrCreateConversation: vi.fn(),
  getSupportUserId: vi.fn(),
  getUnreadCount: vi.fn(async () => 0),
  markConversationAsRead: vi.fn(async () => {}),
  uploadChatImage: vi.fn(),
  sendMessageRest: sendMessageRestMock,
}))

function serverMessage(content = 'hello world'): ChatMessage {
  return {
    id: 'm1',
    conversationId: 'conv-1',
    senderId: 'user-1',
    content,
    attachmentUrl: null,
    attachmentType: null,
    createdAt: '2026-08-30T10:00:00.000Z',
  }
}

function Probe() {
  const chat = useChat()
  return (
    <div>
      <button onClick={() => chat.openConversation('conv-1')}>open</button>
      <button onClick={() => chat.sendMessage('hello world')}>send</button>
      <ul>
        {(chat.messages['conv-1'] ?? []).map((m) => (
          <li key={m.id}>{m.id}|{m.content}</li>
        ))}
      </ul>
    </div>
  )
}

async function openAndSend() {
  render(
    <ChatProvider>
      <Probe />
    </ChatProvider>,
  )
  // Flush the provider's async auth/socket setup.
  await act(async () => {})
  fireEvent.click(screen.getByText('open'))
  await act(async () => {})
  fireEvent.click(screen.getByText('send'))
  await act(async () => {})
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('ChatProvider sendMessage — single message guarantee', () => {
  it('shows exactly one message when the room echo arrives before the ack', async () => {
    await openAndSend()
    expect(socketMock._emitCalls('chat:message')).toHaveLength(1)

    // Server broadcasts the sender's own message back to the conversation room.
    act(() => socketMock._emitEvent('chat:message', { conversationId: 'conv-1', message: serverMessage() }))
    // Then the emit ack arrives with the persisted message.
    act(() => socketMock._ack('chat:message', { status: 'success', data: { message: serverMessage() } }))
    await act(async () => {})

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('m1|hello world')).toBeInTheDocument()
    expect(sendMessageRestMock).not.toHaveBeenCalled()
  })

  it('shows exactly one message when the ack arrives before the echo', async () => {
    await openAndSend()

    act(() => socketMock._ack('chat:message', { status: 'success', data: { message: serverMessage() } }))
    act(() => socketMock._emitEvent('chat:message', { conversationId: 'conv-1', message: serverMessage() }))
    await act(async () => {})

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('m1|hello world')).toBeInTheDocument()
    expect(sendMessageRestMock).not.toHaveBeenCalled()
  })

  it('does not fall back to REST when the echo confirms the socket delivery', async () => {
    vi.useFakeTimers()
    try {
      await openAndSend()
      act(() => socketMock._emitEvent('chat:message', { conversationId: 'conv-1', message: serverMessage() }))
      await act(async () => {})

      // 8s ack timeout elapses — but the echo already confirmed delivery.
      await vi.runAllTimersAsync()
      await act(async () => {})

      expect(sendMessageRestMock).not.toHaveBeenCalled()
      expect(screen.getAllByRole('listitem')).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('falls back to REST only when neither ack nor echo arrives', async () => {
    vi.useFakeTimers()
    try {
      await openAndSend()

      await vi.runAllTimersAsync()
      await act(async () => {})

      expect(sendMessageRestMock).toHaveBeenCalledTimes(1)
      expect(sendMessageRestMock).toHaveBeenCalledWith('conv-1', 'hello world', undefined)
    } finally {
      vi.useRealTimers()
    }
  })
})
