import { describe, it, expect, beforeEach } from 'vitest';
import api from '../../src/renderer/utils/api';

describe('ApiClient', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.removeItem('auth_token');
    localStorage.removeItem('session_id');
    localStorage.removeItem('device_id');
  });

  it('should store token when setToken is called', () => {
    api.setToken('test-token');
    expect(localStorage.getItem('auth_token')).toBe('test-token');
  });

  it('should clear token when setToken is called with null', () => {
    api.setToken('test-token');
    api.setToken(null);
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('should store session ID when setSession is called', () => {
    api.setSession('test-session-id');
    expect(localStorage.getItem('session_id')).toBe('test-session-id');
  });

  it('should clear session ID when setSession is called with null', () => {
    api.setSession('test-session-id');
    api.setSession(null);
    expect(localStorage.getItem('session_id')).toBeNull();
  });

  it('should return false when restoring session without token', async () => {
    const result = await api.restoreSession();
    expect(result).toBe(false);
  });

  it('should report isAuthenticated correctly based on token', () => {
    expect(api.isAuthenticated).toBe(false);
    api.setToken('test-token');
    expect(api.isAuthenticated).toBe(true);
  });
});
