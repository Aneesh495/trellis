/**
 * Fractional indexing and Replicated Growable Array for conflict-free row/column positioning.
 */

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Computes a lexicographically intermediate key strictly between string a and string b.
 */
export function generateFractionalKey(a: string | null, b: string | null): string {
  const pA = a || "a0";
  const pB = b || "z9";

  let i = 0;
  let result = "";

  while (true) {
    const charA = i < pA.length ? pA[i]! : DIGITS[0]!;
    const charB = i < pB.length ? pB[i]! : DIGITS[DIGITS.length - 1]!;

    const idxA = DIGITS.indexOf(charA);
    const idxB = DIGITS.indexOf(charB);

    if (idxA === idxB) {
      result += charA;
      i++;
      continue;
    }

    const midIdx = Math.floor((idxA + idxB) / 2);
    if (midIdx > idxA) {
      result += DIGITS[midIdx]!;
      return result;
    }

    result += charA;
    i++;
    if (i >= pA.length) {
      result += DIGITS[Math.floor(DIGITS.length / 2)]!;
      return result;
    }
  }
}

export interface SequenceItem<T> {
  readonly id: string;
  readonly orderKey: string;
  value: T;
  deleted: boolean;
}

export class FractionalSequence<T> {
  private items: SequenceItem<T>[] = [];

  public insertAfter(afterId: string | null, id: string, value: T): SequenceItem<T> {
    let prevKey: string | null = null;
    let nextKey: string | null = null;

    if (afterId === null) {
      nextKey = this.items.length > 0 ? this.items[0]!.orderKey : null;
    } else {
      const idx = this.items.findIndex((item) => item.id === afterId);
      if (idx !== -1) {
        prevKey = this.items[idx]!.orderKey;
        nextKey = idx + 1 < this.items.length ? this.items[idx + 1]!.orderKey : null;
      }
    }

    const newKey = generateFractionalKey(prevKey, nextKey);
    const item: SequenceItem<T> = {
      id,
      orderKey: newKey,
      value,
      deleted: false
    };

    this.items.push(item);
    this.items.sort((a, b) => a.orderKey.localeCompare(b.orderKey));
    return item;
  }

  public delete(id: string): boolean {
    const item = this.items.find((i) => i.id === id);
    if (item && !item.deleted) {
      item.deleted = true;
      return true;
    }
    return false;
  }

  public getActiveItems(): T[] {
    return this.items.filter((i) => !i.deleted).map((i) => i.value);
  }

  public getAllEntries(): SequenceItem<T>[] {
    return [...this.items];
  }
}
