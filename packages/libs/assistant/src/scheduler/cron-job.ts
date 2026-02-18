/**
 * @ai-stack/assistant - Cron Job
 *
 * Cron-based job scheduling.
 */

import parser from 'cron-parser';
import type { CronSchedule } from './types.js';

/**
 * Parse a cron expression and get the next run time
 */
export function getNextCronTime(schedule: CronSchedule): Date {
  const options: parser.ParserOptions = {
    currentDate: new Date(),
  };

  if (schedule.timezone) {
    options.tz = schedule.timezone;
  }

  const interval = parser.parseExpression(schedule.expression, options);
  return interval.next().toDate();
}

/**
 * Check if a cron expression is valid
 */
export function isValidCronExpression(expression: string): boolean {
  try {
    parser.parseExpression(expression);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get human-readable description of cron schedule
 */
export function describeCronSchedule(schedule: CronSchedule): string {
  const parts = schedule.expression.split(' ');
  if (parts.length !== 5) {
    return schedule.expression;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Common patterns
  if (schedule.expression === '* * * * *') {
    return 'Every minute';
  }
  if (schedule.expression === '0 * * * *') {
    return 'Every hour';
  }
  if (schedule.expression === '0 0 * * *') {
    return 'Every day at midnight';
  }
  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `Every day at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }
  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayIndex = parseInt(dayOfWeek, 10);
    if (dayIndex >= 0 && dayIndex <= 6) {
      return `Every ${days[dayIndex]} at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    }
  }

  // Default to raw expression
  return `Cron: ${schedule.expression}`;
}

/**
 * Create a CronSchedule from an expression
 */
export function createCronSchedule(expression: string, timezone?: string): CronSchedule {
  if (!isValidCronExpression(expression)) {
    throw new Error(`Invalid cron expression: ${expression}`);
  }

  return {
    type: 'cron',
    expression,
    timezone,
  };
}
