/**
 * BarChart - ranked categories against a value axis.
 *
 * Unlike AreaTrendChart this has no continuous x domain (the categories are
 * override reasons, not dates), so bars are laid out on a discrete band scale
 * rather than a linear one. Each bar can hover-highlight independently, same
 * interaction language as the donut's slices.
 */
import * as React from "react";
import { INK, FONT, MONO } from "@/features/shared/tokens";
import { niceTicks, useElementSize, usePrefersReducedMotion } from "./hooks";

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: BarDatum[];
  height?: number;
  color?: string;
  activeKey?: string | null;
  onHover?: (key: string | null) => void;
  valueFormat?: (value: number) => string;
  ariaLabel?: string;
}

const PAD = { top: 12, right: 12, bottom: 34, left: 40 };

export function BarChart({
  data,
  height = 240,
  color = INK.brand,
  activeKey = null,
  onHover,
  valueFormat = (v) => String(Math.round(v)),
  ariaLabel = "Bar chart",
}: BarChartProps) {
  const reduceMotion = usePrefersReducedMotion();
  const [wrapRef, size] = useElementSize<HTMLDivElement>({ width: 480, height });
  const width = Math.max(size.width, 240);

  const plot = {
    left: PAD.left,
    right: width - PAD.right,
    top: PAD.top,
    bottom: height - PAD.bottom,
  };

  const { max, ticks } = React.useMemo(() => niceTicks(Math.max(1, ...data.map((d) => d.value)), 4), [data]);

  const band = (plot.right - plot.left) / Math.max(1, data.length);
  const barWidth = Math.min(48, band * 0.56);

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => {
          const y = plot.bottom - (t / max) * (plot.bottom - plot.top);
          return (
            <g key={t}>
              <line
                x1={plot.left}
                x2={plot.right}
                y1={y}
                y2={y}
                stroke={INK.border}
                strokeWidth={1}
                strokeDasharray={t === 0 ? undefined : "3 4"}
              />
              <text
                x={plot.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                style={{ fontFamily: MONO, fontSize: 10.5, fill: INK.weakest }}
              >
                {valueFormat(t)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const x = plot.left + band * i + (band - barWidth) / 2;
          const h = max > 0 ? (d.value / max) * (plot.bottom - plot.top) : 0;
          const dimmed = activeKey !== null && activeKey !== d.key;
          const fill = d.color ?? color;
          return (
            <g
              key={d.key}
              onPointerEnter={() => onHover?.(d.key)}
              onPointerLeave={() => onHover?.(null)}
              style={{ cursor: onHover ? "pointer" : undefined }}
            >
              <rect
                x={x}
                y={plot.bottom - h}
                width={barWidth}
                height={h}
                rx={5}
                fill={fill}
                opacity={dimmed ? 0.35 : 1}
                style={{
                  transition: reduceMotion ? undefined : "height 260ms ease, y 260ms ease, opacity 160ms ease",
                }}
              />
              <text
                x={x + barWidth / 2}
                y={height - 12}
                textAnchor="middle"
                style={{ fontFamily: FONT, fontSize: 10.5, fill: INK.weakest }}
              >
                {d.label.length > 12 ? `${d.label.slice(0, 11)}…` : d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
