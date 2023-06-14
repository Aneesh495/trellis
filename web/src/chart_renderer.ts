/**
 * High-resolution Canvas chart renderer for column and line time series analytics.
 */

export interface ChartSeries {
  name: string;
  color: string;
  data: number[];
}

export interface ChartConfig {
  title: string;
  labels: string[];
  series: ChartSeries[];
  type: "bar" | "line";
}

export class ChartRenderer {
  public render(canvas: HTMLCanvasElement, config: ChartConfig): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 40, right: 30, bottom: 40, left: 50 };

    // Clear background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 13px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(config.title, width / 2, 22);

    if (config.series.length === 0 || config.labels.length === 0) return;

    // Determine scale bounds
    let maxVal = -Infinity;
    let minVal = 0;
    for (const s of config.series) {
      for (const v of s.data) {
        if (v > maxVal) maxVal = v;
        if (v < minVal) minVal = v;
      }
    }
    if (maxVal <= 0) maxVal = 10;
    maxVal *= 1.15; // 15% headroom

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // Draw horizontal grid lines and Y-axis ticks
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#64748B";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";

    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const yVal = minVal + ((maxVal - minVal) / steps) * i;
      const yPos = padding.top + plotHeight - (i / steps) * plotHeight;

      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(width - padding.right, yPos);
      ctx.stroke();

      ctx.fillText(yVal.toLocaleString(undefined, { maximumFractionDigits: 1 }), padding.left - 6, yPos + 3);
    }

    const nPoints = config.labels.length;
    const xStep = plotWidth / nPoints;

    // Render Bars
    if (config.type === "bar") {
      const barWidth = Math.min(36, xStep * 0.65);

      for (const s of config.series) {
        ctx.fillStyle = s.color;

        for (let i = 0; i < s.data.length; i++) {
          const val = s.data[i] ?? 0;
          const barH = ((val - minVal) / (maxVal - minVal)) * plotHeight;
          const x = padding.left + i * xStep + (xStep - barWidth) / 2;
          const y = padding.top + plotHeight - barH;

          ctx.fillRect(x, y, barWidth, barH);
        }
      }
    }

    // Render Lines
    if (config.type === "line") {
      for (const s of config.series) {
        ctx.strokeStyle = s.color;
        ctx.fillStyle = s.color;
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        for (let i = 0; i < s.data.length; i++) {
          const val = s.data[i] ?? 0;
          const y = padding.top + plotHeight - ((val - minVal) / (maxVal - minVal)) * plotHeight;
          const x = padding.left + i * xStep + xStep / 2;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Point markers
        for (let i = 0; i < s.data.length; i++) {
          const val = s.data[i] ?? 0;
          const y = padding.top + plotHeight - ((val - minVal) / (maxVal - minVal)) * plotHeight;
          const x = padding.left + i * xStep + xStep / 2;

          ctx.beginPath();
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // X-axis Category Labels
    ctx.fillStyle = "#64748B";
    ctx.textAlign = "center";
    ctx.font = "10px sans-serif";
    for (let i = 0; i < nPoints; i++) {
      const x = padding.left + i * xStep + xStep / 2;
      const label = config.labels[i] ?? "";
      ctx.fillText(label, x, height - padding.bottom + 16);
    }
  }
}
