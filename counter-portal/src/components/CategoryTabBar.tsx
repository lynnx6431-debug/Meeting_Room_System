import { useState } from 'react';
import { cn } from '../lib/utils';

// Placeholder tabs — E4-04 will populate from the categories API.
const PLACEHOLDER_TABS = [
  { id: 'all', label: 'All', count: 0 },
  { id: 'drinks', label: 'Drinks', count: 0 },
  { id: 'tidy', label: 'Tidy Up', count: 0 },
  { id: 'snacks', label: 'Snacks', count: 0 },
];

export function CategoryTabBar() {
  const [active, setActive] = useState('all');

  return (
    <div className="flex h-12 items-end border-b border-border bg-background px-8">
      {PLACEHOLDER_TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors',
              isActive
                ? 'border-accent text-foreground'
                : 'border-transparent text-foreground-muted hover:text-foreground',
            )}
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-xs',
                isActive
                  ? 'bg-accent/15 text-accent'
                  : 'bg-background-elevated text-foreground-subtle',
              )}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
