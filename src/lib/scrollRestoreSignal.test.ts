import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  beginScrollRestore,
  endScrollRestore,
  isScrollRestoring,
  SCROLL_RESTORE_EVENT,
} from './scrollRestoreSignal'

describe('scrollRestoreSignal', () => {
  beforeEach(() => {
    while (isScrollRestoring()) endScrollRestore()
  })

  afterEach(() => {
    while (isScrollRestoring()) endScrollRestore()
  })

  it('announces a restore so below-fold sections can mount before the jump', () => {
    const onRestore = vi.fn()
    window.addEventListener(SCROLL_RESTORE_EVENT, onRestore)

    beginScrollRestore()
    expect(isScrollRestoring()).toBe(true)
    expect(onRestore).toHaveBeenCalledTimes(1)

    endScrollRestore()
    expect(isScrollRestoring()).toBe(false)
    window.removeEventListener(SCROLL_RESTORE_EVENT, onRestore)
  })

  it('stays active until the last overlapping restore ends', () => {
    beginScrollRestore()
    beginScrollRestore()
    endScrollRestore()
    expect(isScrollRestoring()).toBe(true)
    endScrollRestore()
    expect(isScrollRestoring()).toBe(false)
  })
})
