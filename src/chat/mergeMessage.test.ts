import { describe, it, expect } from 'vitest'
import { mergeConfirmedMessage } from './mergeMessage'
import type { ChatMessage } from './types'

function msg(id: string, content = 'hi'): ChatMessage {
  return { id, conversationId: 'c1', senderId: 'u1', content, createdAt: '2026-08-30T10:00:00.000Z' }
}

describe('mergeConfirmedMessage', () => {
  it('replaces the optimistic message with the server message', () => {
    const result = mergeConfirmedMessage([msg('tmp-1')], 'tmp-1', msg('m1'))
    expect(result.map((m) => m.id)).toEqual(['m1'])
  })

  it('removes a previously appended echo before replacing (echo-then-ack)', () => {
    const result = mergeConfirmedMessage([msg('tmp-1'), msg('m1')], 'tmp-1', msg('m1'))
    expect(result.map((m) => m.id)).toEqual(['m1'])
  })

  it('keeps a single copy when confirmed again with the same server message', () => {
    const once = mergeConfirmedMessage([msg('tmp-1')], 'tmp-1', msg('m1'))
    expect(once.map((m) => m.id)).toEqual(['m1'])
    const twice = mergeConfirmedMessage(once, 'tmp-1', msg('m1'))
    expect(twice.map((m) => m.id)).toEqual(['m1'])
  })

  it('is a no-op when the optimistic entry is already gone (late confirmation)', () => {
    const result = mergeConfirmedMessage([msg('m2')], 'tmp-1', msg('m1'))
    expect(result.map((m) => m.id)).toEqual(['m2'])
  })

  it('preserves other messages and their order', () => {
    const result = mergeConfirmedMessage([msg('a'), msg('tmp-1'), msg('b')], 'tmp-1', msg('m1'))
    expect(result.map((m) => m.id)).toEqual(['a', 'm1', 'b'])
  })
})
