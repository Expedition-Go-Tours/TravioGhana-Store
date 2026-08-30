import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchWithAuth } from '../lib/api'
import {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessageRest,
  markConversationAsRead,
  getUnreadCount,
  getSupportUserId,
  uploadChatImage,
} from './chatApi'

vi.mock('../lib/api', () => ({
  fetchWithAuth: vi.fn(),
}))

const mockFetchWithAuth = vi.mocked(fetchWithAuth)

function jsonResponse(data: unknown): Response {
  return { ok: true, json: async () => ({ status: 'success', data }) } as unknown as Response
}

const conversation = {
  id: 'conv-1',
  type: 'SUPPLIER_CUSTOMER',
  createdAt: '2026-08-27T10:00:00.000Z',
  updatedAt: '2026-08-27T10:00:00.000Z',
  participants: [],
  unreadCount: 2,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('chatApi', () => {
  it('getConversations returns the conversation list', async () => {
    mockFetchWithAuth.mockResolvedValueOnce(jsonResponse({ conversations: [conversation] }))
    const result = await getConversations()
    expect(mockFetchWithAuth).toHaveBeenCalledWith('/chat/conversations')
    expect(result).toEqual([conversation])
  })

  it('getOrCreateConversation posts recipient + type and returns the conversation', async () => {
    mockFetchWithAuth.mockResolvedValueOnce(jsonResponse({ conversation }))
    const result = await getOrCreateConversation('supplier-1', 'SUPPLIER_CUSTOMER')
    expect(mockFetchWithAuth).toHaveBeenCalledWith('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ recipientId: 'supplier-1', type: 'SUPPLIER_CUSTOMER' }),
    })
    expect(result).toEqual(conversation)
  })

  it('getMessages sends the cursor and returns the page', async () => {
    const page = { messages: [{ id: 'm1', conversationId: 'conv-1', senderId: 'u1', content: 'hi', createdAt: '2026-08-27T09:00:00.000Z' }], nextCursor: null, hasMore: false }
    mockFetchWithAuth.mockResolvedValueOnce(jsonResponse(page))
    const result = await getMessages('conv-1', '2026-08-27T08:00:00.000Z', 30)
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      '/chat/conversations/conv-1/messages?limit=30&cursor=2026-08-27T08%3A00%3A00.000Z',
    )
    expect(result).toEqual(page)
  })

  it('sendMessageRest posts content and attachment', async () => {
    const message = { id: 'm2', conversationId: 'conv-1', senderId: 'u1', content: 'hello', createdAt: '2026-08-27T10:00:00.000Z' }
    mockFetchWithAuth.mockResolvedValueOnce(jsonResponse({ message }))
    const result = await sendMessageRest('conv-1', 'hello', { url: 'https://img', type: 'image' })
    expect(mockFetchWithAuth).toHaveBeenCalledWith('/chat/conversations/conv-1/messages', {
      method: 'POST',
      body: JSON.stringify({ content: 'hello', attachmentUrl: 'https://img', attachmentType: 'image' }),
    })
    expect(result).toEqual(message)
  })

  it('markConversationAsRead patches the read endpoint', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({ ok: true } as Response)
    await markConversationAsRead('conv-1')
    expect(mockFetchWithAuth).toHaveBeenCalledWith('/chat/conversations/conv-1/read', { method: 'PATCH' })
  })

  it('getUnreadCount returns the count', async () => {
    mockFetchWithAuth.mockResolvedValueOnce(jsonResponse({ unreadCount: 3 }))
    expect(await getUnreadCount()).toBe(3)
  })

  it('getSupportUserId returns the expedition identity', async () => {
    mockFetchWithAuth.mockResolvedValueOnce(jsonResponse({ expeditionId: 'exp-1' }))
    expect(await getSupportUserId()).toBe('exp-1')
    expect(mockFetchWithAuth).toHaveBeenCalledWith('/chat/expedition-support')
  })

  it('getSupportUserId falls back to the admin identity when expedition support is not configured', async () => {
    mockFetchWithAuth
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce(jsonResponse({ adminId: 'admin-1' }))
    expect(await getSupportUserId()).toBe('admin-1')
    expect(mockFetchWithAuth).toHaveBeenNthCalledWith(1, '/chat/expedition-support')
    expect(mockFetchWithAuth).toHaveBeenNthCalledWith(2, '/chat/admin-support')
  })

  it('getSupportUserId returns null when unavailable', async () => {
    mockFetchWithAuth
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
    expect(await getSupportUserId()).toBeNull()
  })

  it('uploadChatImage posts a multipart form', async () => {
    mockFetchWithAuth.mockResolvedValueOnce(jsonResponse({ url: 'https://cdn/x.jpg', type: 'image' }))
    const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' })
    const result = await uploadChatImage(file)
    expect(result).toEqual({ url: 'https://cdn/x.jpg', type: 'image' })
    const [path, options] = mockFetchWithAuth.mock.calls[0]
    expect(path).toBe('/chat/upload')
    expect(options?.method).toBe('POST')
    expect(options?.body).toBeInstanceOf(FormData)
  })
})
