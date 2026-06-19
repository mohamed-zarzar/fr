import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns';

interface AttendanceItem {
  id: string;
  date: string;
  isJustified: boolean;
  reason?: string;
  period?: number;
  session?: string;
  [key: string]: any;
}

interface AttendanceCalendarViewProps {
  items: AttendanceItem[];
  type: 'absences' | 'lates';
  getEntityName?: (item: AttendanceItem) => string;
  onEdit?: (item: AttendanceItem) => void;
  onDelete?: (item: AttendanceItem) => void;
  showEntity?: boolean;
  isShowMixed?:boolean;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function AttendanceCalendarView({ items, type, getEntityName, onEdit, onDelete, showEntity = true,isShowMixed=true }: AttendanceCalendarViewProps) {
  const { t } = useTranslation();
  const [month, setMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const typeLabel = type === 'absences' ? t('attendance.absences').toLowerCase() : t('attendance.lates').toLowerCase();

  const dateMap = useMemo(() => {
    const map = new Map<string, AttendanceItem[]>();
    items.forEach(item => {
      const key = item.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return map;
  }, [items]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const selectedItems = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, 'yyyy-MM-dd');
    return dateMap.get(key) || [];
  }, [selectedDate, dateMap]);

  const getDayStatus = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd');
    const dayItems = dateMap.get(key);
    if (!dayItems || dayItems.length === 0) return null;
    const allJustified = dayItems.every(i => i.isJustified);
    const allUnjustified = dayItems.every(i => !i.isJustified);
    return {
      count: dayItems.length,
      status: allJustified ? 'justified' : allUnjustified ? 'unjustified' : 'mixed',
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-4">
        <Card className="flex-1 min-w-0">
          <CardContent className="p-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth(m => subMonths(m, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-sm font-semibold text-foreground">{format(month, 'MMMM yyyy')}</h3>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth(m => addMonths(m, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map(day => {
                const inMonth = isSameMonth(day, month);
                const today = isToday(day);
                const selected = selectedDate && isSameDay(day, selectedDate);
                const info = getDayStatus(day);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(prev => prev && isSameDay(prev, day) ? null : day)}
                    className={cn(
                      'relative flex flex-col items-center justify-center rounded-lg p-1 min-h-[52px] text-sm transition-all border',
                      !inMonth && 'opacity-30',
                      inMonth && !info && 'border-transparent hover:bg-muted/50',
                      today && !info && 'border-primary/30 bg-primary/5',
                      selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                      info?.status === 'unjustified' && 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20',
                      info?.status === 'justified' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20',
                      info?.status === 'mixed' && 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20',
                    )}
                  >
                    <span className={cn(
                      'text-xs font-medium',
                      today && 'font-bold',
                      !info && inMonth && 'text-foreground',
                    )}>
                      {format(day, 'd')}
                    </span>
                    {info && (
                      <span className={cn(
                        'text-[10px] font-bold mt-0.5 leading-none',
                        info.status === 'unjustified' && 'text-destructive',
                        info.status === 'justified' && 'text-emerald-600 dark:text-emerald-400',
                        info.status === 'mixed' && 'text-amber-600 dark:text-amber-400',
                      )}>
                        +{info.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-3 pt-3 border-t border-border">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-3 rounded-sm bg-emerald-500/20 border border-emerald-500/40" /> {t('attendance.justified')}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-3 rounded-sm bg-destructive/20 border border-destructive/40" /> {t('attendance.unjustified')}
              </span>
             {isShowMixed && <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-3 rounded-sm bg-amber-500/20 border border-amber-500/40" /> {t('attendance.mixed')}
              </span>}
            </div>
          </CardContent>
        </Card>

        {/* Details panel */}
        <Card className="lg:w-80 flex-shrink-0">
          <CardContent className="p-4">
            {!selectedDate ? (
              <p className="text-muted-foreground text-sm py-8 text-center">{t('attendance.clickDateToView', { type: typeLabel })}</p>
            ) : (
              <div className="space-y-3">
                <h3 className="font-medium text-sm border-b border-border pb-2">
                  {format(selectedDate, 'EEE, MMM d, yyyy')}
                  <span className="ml-2 text-muted-foreground">({selectedItems.length} {typeLabel})</span>
                </h3>
                {selectedItems.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">{t('attendance.noOnDate', { type: typeLabel })}</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {selectedItems.map(item => (
                      <div key={item.id} className="flex items-start gap-2 p-2.5 rounded-md border bg-muted/30">
                        <div className="flex-1 min-w-0 space-y-1">
                          {showEntity && getEntityName && <p className="font-medium text-sm truncate">{getEntityName(item)}</p>}
                          {item.session && <p className="text-xs text-muted-foreground">{item.session}</p>}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant={item.isJustified ? 'default' : 'destructive'} className="text-[10px] h-5">
                              {item.isJustified ? t('attendance.justified') : t('attendance.unjustified')}
                            </Badge>
                            {type === 'lates' && item.period && (
                              <Badge variant="outline" className="text-[10px] h-5">{item.period} {t('attendance.min')}</Badge>
                            )}
                          </div>
                          {item.reason && <p className="text-xs text-muted-foreground line-clamp-2">{item.reason}</p>}
                        </div>
                        {(onEdit || onDelete) && (
                          <div className="flex gap-0.5 flex-shrink-0">
                            {onEdit && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(item)}><Pencil className="h-3 w-3" /></Button>}
                            {onDelete && <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete(item)}><Trash2 className="h-3 w-3" /></Button>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
