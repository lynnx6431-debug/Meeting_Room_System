import { Minus, Plus } from 'lucide-react';
import { cn } from '../lib/utils';

const SHORTCUTS = [1, 2, 4, 6, 8, 10];

type HeadcountPickerProps = {
  value: number;
  onChange: (nextValue: number) => void;
  disabled?: boolean;
};

export function HeadcountPicker({ value, onChange, disabled = false }: HeadcountPickerProps) {
  const dec = () => onChange(Math.max(1, value - 1));
  const inc = () => onChange(Math.min(10, value + 1));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-7">
        <button
          type="button"
          onClick={dec}
          disabled={disabled || value <= 1}
          aria-label="Decrease headcount"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-foreground/20 text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-30"
        >
          <Minus size={20} />
        </button>

        <span className="min-w-[60px] text-center font-serif text-5xl italic tabular-nums text-foreground/90">
          {value}
        </span>

        <button
          type="button"
          onClick={inc}
          disabled={disabled || value >= 10}
          aria-label="Increase headcount"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-95 disabled:opacity-30"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="flex items-center justify-center gap-2">
        {SHORTCUTS.map((shortcut) => (
          <button
            key={shortcut}
            type="button"
            onClick={() => onChange(shortcut)}
            disabled={disabled}
            className={cn(
              'h-9 w-9 rounded-full border text-sm transition',
              value === shortcut
                ? 'border-primary/30 bg-primary/10 font-medium text-primary'
                : 'border-transparent text-foreground/50 hover:bg-foreground/5',
            )}
          >
            {shortcut}
          </button>
        ))}
      </div>
    </div>
  );
}
