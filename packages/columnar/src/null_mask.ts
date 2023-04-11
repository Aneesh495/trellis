/**
 * Bit-packed 32-bit integer null mask for zero-overhead blank/null tracking.
 */

export class NullBitMask {
  public readonly words: Uint32Array;
  public readonly size: number;

  constructor(size: number) {
    this.size = size;
    const wordCount = Math.ceil(size / 32);
    this.words = new Uint32Array(wordCount);
  }

  /**
   * Sets whether the value at 0-indexed position is null.
   */
  public setNull(index: number, isNull: boolean): void {
    if (index < 0 || index >= this.size) return;
    const wordIdx = Math.floor(index / 32);
    const bitIdx = index % 32;

    if (isNull) {
      this.words[wordIdx]! |= 1 << bitIdx;
    } else {
      this.words[wordIdx]! &= ~(1 << bitIdx);
    }
  }

  /**
   * Returns true if value at index is marked null.
   */
  public isNull(index: number): boolean {
    if (index < 0 || index >= this.size) return true;
    const wordIdx = Math.floor(index / 32);
    const bitIdx = index % 32;
    return (this.words[wordIdx]! & (1 << bitIdx)) !== 0;
  }

  /**
   * Returns true if all bits are 1 (entire chunk is null).
   */
  public allNull(): boolean {
    for (let i = 0; i < this.words.length; i++) {
      if (this.words[i] !== 0xffffffff) {
        return false;
      }
    }
    return true;
  }

  /**
   * Returns true if all bits are 0 (no null values present).
   */
  public noneNull(): boolean {
    for (let i = 0; i < this.words.length; i++) {
      if (this.words[i] !== 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Counts the total number of set bits (null count) using bit-counting algorithm.
   */
  public countNulls(): number {
    let count = 0;
    for (let i = 0; i < this.words.length; i++) {
      let w = this.words[i]!;
      // Brian Kernighan bit count
      while (w !== 0) {
        w &= w - 1;
        count++;
      }
    }
    return count;
  }

  public fillAllNull(): void {
    this.words.fill(0xffffffff);
  }

  public clearAll(): void {
    this.words.fill(0);
  }
}
