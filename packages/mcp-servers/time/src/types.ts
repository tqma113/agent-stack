/**
 * Types for @ai-stack-mcp/time
 */

import { z } from 'zod';

/**
 * IANA timezone name pattern
 * Examples: America/New_York, Europe/London, Asia/Tokyo
 */
const timezoneSchema = z.string().describe('IANA timezone name (e.g., "America/New_York", "Europe/London", "Asia/Tokyo")');

/**
 * Time format (24-hour): HH:MM
 */
const timeFormatSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in 24-hour format (HH:MM)');

/**
 * get_current_time tool input schema
 */
export const GetCurrentTimeInputSchema = z.object({
  timezone: timezoneSchema.optional().describe('IANA timezone name. If not provided, uses system timezone'),
});

export type GetCurrentTimeInput = z.infer<typeof GetCurrentTimeInputSchema>;

/**
 * convert_time tool input schema
 */
export const ConvertTimeInputSchema = z.object({
  source_timezone: timezoneSchema.describe('Source IANA timezone name'),
  time: timeFormatSchema.describe('Time in 24-hour format (HH:MM)'),
  target_timezone: timezoneSchema.describe('Target IANA timezone name'),
});

export type ConvertTimeInput = z.infer<typeof ConvertTimeInputSchema>;

/**
 * Time info result
 */
export interface TimeInfo {
  timezone: string;
  datetime: string;
  is_dst: boolean;
}

/**
 * get_current_time result
 */
export interface GetCurrentTimeResult extends TimeInfo {}

/**
 * convert_time result
 */
export interface ConvertTimeResult {
  source: TimeInfo;
  target: TimeInfo;
  time_difference: string;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  name?: string;
  version?: string;
  localTimezone?: string;
}

/**
 * Error types
 */
export class TimeError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'TimeError';
  }
}
