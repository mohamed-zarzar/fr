import { Button } from '@/components/ui/button';
import { List, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ViewToggleProps {
  view: 'table' | 'calendar';
  onViewChange: (view: 'table' | 'calendar') => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center rounded-md border bg-muted p-0.5">
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-7 px-2 gap-1.5 rounded-sm', view === 'table' && 'bg-background shadow-sm')}
        onClick={() => onViewChange('table')}
      >
        <List className="h-3.5 w-3.5" />
        <span className="text-xs">Table</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-7 px-2 gap-1.5 rounded-sm', view === 'calendar' && 'bg-background shadow-sm')}
        onClick={() => onViewChange('calendar')}
      >
        <CalendarDays className="h-3.5 w-3.5" />
        <span className="text-xs">Calendar</span>
      </Button>
    </div>
  );
}
