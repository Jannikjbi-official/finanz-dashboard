"use client";

import { ColorArea, ColorPicker, ColorSlider, ColorSwatch, ColorSwatchPicker, Label, parseColor } from "@heroui/react";

export const COLOR_PRESETS = [
  "#5b5cf0",
  "#8a3ffc",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#64748b",
];

/** HeroUI ColorPicker (Fläche, Farbton, Vorlagen) – Wert als #rrggbb. */
export function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <ColorPicker value={parseColor(value)} onChange={(c) => onChange(c.toString("hex"))}>
      <ColorPicker.Trigger className="flex min-h-11 items-center gap-3 rounded-[var(--field-radius)] bg-[var(--field-background)] px-3 py-2">
        <ColorSwatch size="md" />
        <span className="flex flex-col items-start">
          <Label>{label}</Label>
          <span className="tabular text-xs text-muted uppercase">{value}</span>
        </span>
      </ColorPicker.Trigger>
      <ColorPicker.Popover className="flex w-64 flex-col gap-3">
        <ColorArea aria-label="Farbfläche" className="max-w-full" colorSpace="hsb" xChannel="saturation" yChannel="brightness">
          <ColorArea.Thumb />
        </ColorArea>
        <ColorSlider channel="hue" className="gap-1 px-1" colorSpace="hsb">
          <Label>Farbton</Label>
          <ColorSlider.Output className="text-muted" />
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider>
        <ColorSwatchPicker aria-label="Vorlagen" className="justify-center" size="xs">
          {COLOR_PRESETS.map((preset) => (
            <ColorSwatchPicker.Item key={preset} color={preset}>
              <ColorSwatchPicker.Swatch />
            </ColorSwatchPicker.Item>
          ))}
        </ColorSwatchPicker>
      </ColorPicker.Popover>
    </ColorPicker>
  );
}
