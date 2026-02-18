/**
 * Timezone utilities for @ai-stack-mcp/time
 */

import type { TimeInfo } from './types.js';
import { TimeError } from './types.js';

/**
 * Get system timezone using IANA format
 */
export function getSystemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Check if a timezone is valid IANA timezone
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate timezone and throw error if invalid
 */
export function validateTimezone(timezone: string): void {
  if (!isValidTimezone(timezone)) {
    throw new TimeError(
      `Invalid timezone: "${timezone}". Please use a valid IANA timezone name (e.g., "America/New_York", "Europe/London")`,
      'INVALID_TIMEZONE'
    );
  }
}

/**
 * Check if DST is in effect for a given date and timezone
 */
export function isDST(date: Date, timezone: string): boolean {
  // Get January and July dates in the same year
  const january = new Date(date.getFullYear(), 0, 1);
  const july = new Date(date.getFullYear(), 6, 1);

  // Get UTC offsets for January and July
  const getOffset = (d: Date): number => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    });
    const parts = formatter.formatToParts(d);
    const offsetPart = parts.find((p) => p.type === 'timeZoneName');
    if (!offsetPart) return 0;

    // Parse offset like "GMT+01:00" or "GMT-05:00"
    const match = offsetPart.value.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!match) return 0;

    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2], 10);
    const minutes = parseInt(match[3], 10);
    return sign * (hours * 60 + minutes);
  };

  const januaryOffset = getOffset(january);
  const julyOffset = getOffset(july);
  const currentOffset = getOffset(date);

  // Standard time has the smaller offset (more negative or less positive)
  // DST has the larger offset
  const standardOffset = Math.min(januaryOffset, julyOffset);
  return currentOffset !== standardOffset;
}

/**
 * Get time info for a specific timezone
 */
export function getTimeInfo(date: Date, timezone: string): TimeInfo {
  validateTimezone(timezone);

  // Format datetime in ISO 8601 with timezone offset
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((p) => p.type === type);
    return part?.value || '';
  };

  const dateStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  const timeStr = `${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;

  // Get timezone offset
  const offsetFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  });
  const offsetParts = offsetFormatter.formatToParts(date);
  const offsetPart = offsetParts.find((p) => p.type === 'timeZoneName');
  let offset = '+00:00';
  if (offsetPart) {
    const match = offsetPart.value.match(/GMT([+-]\d{2}:\d{2})/);
    if (match) {
      offset = match[1];
    }
  }

  return {
    timezone,
    datetime: `${dateStr}T${timeStr}${offset}`,
    is_dst: isDST(date, timezone),
  };
}

/**
 * Parse time string (HH:MM) and create a Date object in the specified timezone
 */
export function parseTimeInTimezone(time: string, timezone: string): Date {
  validateTimezone(timezone);

  const now = new Date();

  // Create a date string in the target timezone for today
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(now);

  // Parse the date and time
  const targetDate = new Date(`${dateStr}T${time}:00`);

  // Adjust for timezone difference
  const localOffset = targetDate.getTimezoneOffset();
  const targetOffset = getTimezoneOffset(targetDate, timezone);
  const diff = (localOffset + targetOffset) * 60 * 1000;

  return new Date(targetDate.getTime() - diff);
}

/**
 * Get timezone offset in minutes (positive = ahead of UTC)
 */
export function getTimezoneOffset(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  });
  const parts = formatter.formatToParts(date);
  const offsetPart = parts.find((p) => p.type === 'timeZoneName');

  if (!offsetPart) return 0;

  const match = offsetPart.value.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;

  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);
  return sign * (hours * 60 + minutes);
}

/**
 * Calculate time difference between two timezones
 */
export function getTimeDifference(sourceTimezone: string, targetTimezone: string, date: Date): string {
  const sourceOffset = getTimezoneOffset(date, sourceTimezone);
  const targetOffset = getTimezoneOffset(date, targetTimezone);
  const diffMinutes = targetOffset - sourceOffset;
  const diffHours = diffMinutes / 60;

  const sign = diffHours >= 0 ? '+' : '';
  // Format as +X.Xh or -X.Xh
  if (Number.isInteger(diffHours)) {
    return `${sign}${diffHours}.0h`;
  }
  return `${sign}${diffHours.toFixed(1)}h`;
}
