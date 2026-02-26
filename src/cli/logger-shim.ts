const noop = () => {}

const noopLogger = {
  info: noop,
  warn: noop,
  error: noop,
  debug: noop,
  trace: noop,
  fatal: noop,
  child: () => noopLogger,
  level: 'silent',
}

export const logger = noopLogger

export function createScanLogger() {
  return noopLogger
}

export function createCorrelationLogger() {
  return noopLogger
}
