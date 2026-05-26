import { useRef, useCallback, useMemo } from "react"

export interface VirtualItem {
  index: number
  start: number
  size: number
  key: string
}

export interface VirtualizerConfig {
  itemCount: number
  estimatedItemSize: number
  overscan?: number
  containerHeight: number
  scrollTop: number
}

export interface VirtualizerResult {
  virtualItems: VirtualItem[]
  totalSize: number
  startOffset: number
  endOffset: number
}

const DEFAULT_OVERSCAN = 5

export function useVirtualizer(config: VirtualizerConfig): VirtualizerResult {
  const { itemCount, estimatedItemSize, overscan = DEFAULT_OVERSCAN, containerHeight, scrollTop } = config

  const measurementsRef = useRef<Map<number, number>>(new Map())
  const totalMeasuredSize = useRef(0)

  const getSize = useCallback((index: number): number => {
    return measurementsRef.current.get(index) ?? estimatedItemSize
  }, [estimatedItemSize])

  const result = useMemo(() => {
    if (itemCount === 0) {
      return { virtualItems: [], totalSize: 0, startOffset: 0, endOffset: 0 }
    }

    const totalSize = itemCount * estimatedItemSize
    const startIndex = Math.max(0, Math.floor(scrollTop / estimatedItemSize) - overscan)
    const visibleCount = Math.ceil(containerHeight / estimatedItemSize) + overscan * 2
    const endIndex = Math.min(itemCount - 1, startIndex + visibleCount)

    const virtualItems: VirtualItem[] = []
    let offsetY = 0

    for (let i = 0; i < startIndex; i++) {
      offsetY += getSize(i)
    }

    for (let i = startIndex; i <= endIndex; i++) {
      const size = getSize(i)
      virtualItems.push({
        index: i,
        start: offsetY,
        size,
        key: `item-${i}`,
      })
      offsetY += size
    }

    return {
      virtualItems,
      totalSize,
      startOffset: 0,
      endOffset: totalSize - offsetY,
    }
  }, [itemCount, estimatedItemSize, overscan, containerHeight, scrollTop, getSize])

  return result
}

export function estimateTotalSize(
  itemCount: number,
  estimatedItemSize: number,
  measuredSizes: Map<number, number>,
): number {
  if (measuredSizes.size === 0) return itemCount * estimatedItemSize
  let total = 0
  for (let i = 0; i < itemCount; i++) {
    total += measuredSizes.get(i) ?? estimatedItemSize
  }
  return total
}
