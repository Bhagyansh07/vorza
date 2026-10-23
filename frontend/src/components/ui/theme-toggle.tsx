import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className={cn(
        'group relative flex h-9 items-center gap-2 rounded-full border border-line/70 bg-surface/80 px-3 py-1.5 text-xs font-semibold text-ink-dim shadow-xs backdrop-blur-xl transition-all hover:border-primary/50 hover:bg-surface hover:text-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      {theme === 'dark' ? (
        <>
          <Moon className="h-4 w-4 text-primary transition-transform group-hover:-rotate-12" />
          <span className="text-[11px] font-medium tracking-wide">Dark</span>
        </>
      ) : (
        <>
          <Sun className="h-4 w-4 text-signal-warn transition-transform group-hover:rotate-45" />
          <span className="text-[11px] font-medium tracking-wide">Light</span>
        </>
      )}
    </button>
  );
}
