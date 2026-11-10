/**
 * Console Logging Utilities
 * Provides colored console output for better readability
 */

export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

export function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}
