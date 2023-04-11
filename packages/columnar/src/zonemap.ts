/**
 * Chunk-level Zone Map containing min, max, sum, and null statistics for accelerated scan pruning.
 */

export class ZoneMap {
  public min = Infinity;
  public max = -Infinity;
  public sum = 0;
  public count = 0;
  public nullCount = 0;
  public hasErrors = false;

  public reset(): void {
    this.min = Infinity;
    this.max = -Infinity;
    this.sum = 0;
    this.count = 0;
    this.nullCount = 0;
    this.hasErrors = false;
  }

  public recordValue(val: number): void {
    if (val < this.min) this.min = val;
    if (val > this.max) this.max = val;
    this.sum += val;
    this.count++;
  }

  public recordNull(): void {
    this.nullCount++;
  }

  public recordError(): void {
    this.hasErrors = true;
  }

  /**
   * Evaluates if a predicate interval [targetMin..targetMax] can be pruned without scanning chunk items.
   */
  public canPrune(targetMin: number, targetMax: number): boolean {
    if (this.count === 0) return true;
    return this.max < targetMin || this.min > targetMax;
  }
}
