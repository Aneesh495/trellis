/**
 * Style registry, typography, fill patterns, and custom number formatting rules.
 */

import { CellFormat } from "@trellis/core";

export interface WorkbookTheme {
  primaryColor: string;
  headerBackground: string;
  gridLineColor: string;
  selectionColor: string;
  fontFamily: string;
  fontSize: number;
}

export const DEFAULT_THEME: WorkbookTheme = {
  primaryColor: "#2563eb",
  headerBackground: "#1e293b",
  gridLineColor: "#334155",
  selectionColor: "rgba(37, 99, 235, 0.25)",
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontSize: 13
};

export class StyleRegistry {
  private readonly styles: Map<string, CellFormat> = new Map();

  public register(key: string, format: CellFormat): void {
    this.styles.set(key, format);
  }

  public get(key: string): CellFormat | undefined {
    return this.styles.get(key);
  }

  /**
   * Applies number format string (e.g. "$#,##0.00", "0.0%", "YYYY-MM-DD") to a raw value.
   */
  public formatValue(value: unknown, formatString?: string): string {
    if (value === null || value === undefined) return "";
    if (!formatString) return String(value);

    if (typeof value === "number") {
      // Currency format e.g. $#,##0.00
      if (formatString.includes("$")) {
        const decimals = (formatString.split(".")[1] || "").length;
        return "$" + value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      }

      // Percentage format e.g. 0.0%
      if (formatString.includes("%")) {
        const decimals = (formatString.replace("%", "").split(".")[1] || "").length;
        return (value * 100).toFixed(decimals) + "%";
      }

      // Integer with commas e.g. #,##0
      if (formatString.includes(",")) {
        const decimals = (formatString.split(".")[1] || "").length;
        return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      }

      // Standard decimal e.g. 0.00
      if (formatString.includes(".")) {
        const decimals = (formatString.split(".")[1] || "").length;
        return value.toFixed(decimals);
      }
    }

    return String(value);
  }
}
