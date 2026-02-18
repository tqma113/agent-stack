/**
 * @ai-stack/assistant - Reminder
 *
 * One-time reminder scheduling.
 */

import type { ReminderSchedule } from './types.js';

/**
 * Parse natural language time specification
 */
export function parseNaturalTime(input: string): Date | null {
  const now = new Date();
  const lowerInput = input.toLowerCase().trim();

  // Try to parse as ISO date
  const isoDate = new Date(input);
  if (!isNaN(isoDate.getTime()) && input.includes('-')) {
    return isoDate;
  }

  // Relative time patterns
  const relativePatterns: Array<{ pattern: RegExp; handler: (match: RegExpMatchArray) => Date }> = [
    // "in X minutes/hours/days"
    {
      pattern: /^in\s+(\d+)\s*(minute|min|m)s?$/i,
      handler: (m) => new Date(now.getTime() + parseInt(m[1], 10) * 60 * 1000),
    },
    {
      pattern: /^in\s+(\d+)\s*(hour|hr|h)s?$/i,
      handler: (m) => new Date(now.getTime() + parseInt(m[1], 10) * 60 * 60 * 1000),
    },
    {
      pattern: /^in\s+(\d+)\s*(day|d)s?$/i,
      handler: (m) => new Date(now.getTime() + parseInt(m[1], 10) * 24 * 60 * 60 * 1000),
    },
    {
      pattern: /^in\s+(\d+)\s*(week|wk|w)s?$/i,
      handler: (m) => new Date(now.getTime() + parseInt(m[1], 10) * 7 * 24 * 60 * 60 * 1000),
    },

    // "X minutes/hours from now"
    {
      pattern: /^(\d+)\s*(minute|min|m)s?\s+from\s+now$/i,
      handler: (m) => new Date(now.getTime() + parseInt(m[1], 10) * 60 * 1000),
    },
    {
      pattern: /^(\d+)\s*(hour|hr|h)s?\s+from\s+now$/i,
      handler: (m) => new Date(now.getTime() + parseInt(m[1], 10) * 60 * 60 * 1000),
    },

    // "tomorrow at HH:MM"
    {
      pattern: /^tomorrow\s+at\s+(\d{1,2}):(\d{2})$/i,
      handler: (m) => {
        const date = new Date(now);
        date.setDate(date.getDate() + 1);
        date.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
        return date;
      },
    },

    // "tomorrow"
    {
      pattern: /^tomorrow$/i,
      handler: () => {
        const date = new Date(now);
        date.setDate(date.getDate() + 1);
        date.setHours(9, 0, 0, 0); // Default to 9 AM
        return date;
      },
    },

    // "at HH:MM" (today or tomorrow if past)
    {
      pattern: /^at\s+(\d{1,2}):(\d{2})$/i,
      handler: (m) => {
        const date = new Date(now);
        date.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
        if (date <= now) {
          date.setDate(date.getDate() + 1);
        }
        return date;
      },
    },

    // "HH:MM" (today or tomorrow if past)
    {
      pattern: /^(\d{1,2}):(\d{2})$/,
      handler: (m) => {
        const date = new Date(now);
        date.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
        if (date <= now) {
          date.setDate(date.getDate() + 1);
        }
        return date;
      },
    },
  ];

  for (const { pattern, handler } of relativePatterns) {
    const match = lowerInput.match(pattern);
    if (match) {
      return handler(match);
    }
  }

  return null;
}

/**
 * Create a ReminderSchedule
 */
export function createReminderSchedule(triggerAt: Date | string, reminderText?: string): ReminderSchedule {
  let triggerDate: Date;

  if (typeof triggerAt === 'string') {
    const parsed = parseNaturalTime(triggerAt);
    if (!parsed) {
      throw new Error(`Could not parse time: ${triggerAt}`);
    }
    triggerDate = parsed;
  } else {
    triggerDate = triggerAt;
  }

  if (triggerDate <= new Date()) {
    throw new Error('Reminder time must be in the future');
  }

  return {
    type: 'reminder',
    triggerAt: triggerDate,
    reminderText,
  };
}

/**
 * Format a reminder for display
 */
export function formatReminder(schedule: ReminderSchedule): string {
  const date = schedule.triggerAt;
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff < 0) {
    return 'Overdue';
  }

  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));

  if (days > 0) {
    return `In ${days} day${days > 1 ? 's' : ''} (${formatDateTime(date)})`;
  }
  if (hours > 0) {
    return `In ${hours} hour${hours > 1 ? 's' : ''} (${formatTime(date)})`;
  }
  if (minutes > 0) {
    return `In ${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  return 'Very soon';
}

/**
 * Format date and time
 */
function formatDateTime(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return date.toLocaleString('en-US', options);
}

/**
 * Format time only
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
