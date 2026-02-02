import { describe, it, expect, vi } from 'vitest';
import { createDebugLogger } from './debug';

describe('debug logger', () => {
  it('logs when enabled', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createDebugLogger(true);
    logger('test');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not log when disabled', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createDebugLogger(false);
    logger('test');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
