/**
 * Hybrid Logical Clock (HLC) ensuring strict causal ordering and wall-clock monotonic guarantees.
 */

export class HLC {
  public millis: number;
  public counter: number;
  public readonly nodeId: string;

  constructor(millis: number, counter: number, nodeId: string) {
    this.millis = millis;
    this.counter = counter;
    this.nodeId = nodeId;
  }

  /**
   * Generates a new HLC instance initialized to current physical wall time.
   */
  public static create(nodeId: string): HLC {
    return new HLC(Date.now(), 0, nodeId);
  }

  /**
   * Advances the local clock for an internal event or outbound message.
   */
  public now(): HLC {
    const physical = Date.now();
    if (physical > this.millis) {
      this.millis = physical;
      this.counter = 0;
    } else {
      this.counter++;
    }
    return new HLC(this.millis, this.counter, this.nodeId);
  }

  /**
   * Merges an incoming remote HLC timestamp updating local causality.
   */
  public update(remote: HLC): HLC {
    const physical = Date.now();

    if (physical > this.millis && physical > remote.millis) {
      this.millis = physical;
      this.counter = 0;
    } else if (this.millis === remote.millis) {
      this.counter = Math.max(this.counter, remote.counter) + 1;
    } else if (this.millis > remote.millis) {
      this.counter++;
    } else {
      this.millis = remote.millis;
      this.counter = remote.counter + 1;
    }

    return new HLC(this.millis, this.counter, this.nodeId);
  }

  /**
   * Compares two HLC timestamps according to strict causal ordering:
   * 1. Physical time millis
   * 2. Logical counter
   * 3. Deterministic tie-breaker on nodeId string
   */
  public compare(other: HLC): number {
    if (this.millis !== other.millis) {
      return this.millis - other.millis;
    }
    if (this.counter !== other.counter) {
      return this.counter - other.counter;
    }
    return this.nodeId.localeCompare(other.nodeId);
  }

  /**
   * Serializes HLC into a lexicographically sortable string token.
   */
  public toString(): string {
    const pTime = this.millis.toString(36).padStart(11, "0");
    const pCount = this.counter.toString(36).padStart(5, "0");
    return `${pTime}:${pCount}:${this.nodeId}`;
  }

  /**
   * Deserializes an HLC instance from its string token representation.
   */
  public static fromString(str: string): HLC {
    const parts = str.split(":");
    if (parts.length < 3) {
      throw new Error(`Malformed HLC string: ${str}`);
    }
    const millis = parseInt(parts[0]!, 36);
    const counter = parseInt(parts[1]!, 36);
    const nodeId = parts.slice(2).join(":");
    return new HLC(millis, counter, nodeId);
  }
}
