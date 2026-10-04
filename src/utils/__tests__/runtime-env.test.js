// src/utils/__tests__/runtime-env.test.js
import { getBackendUri } from '../runtime-env';

describe('getBackendUri', () => {
  const originalEnv = process.env.REACT_APP_BACKEND_URI;

  afterEach(() => {
    delete window._env_;
    if (originalEnv === undefined) {
      delete process.env.REACT_APP_BACKEND_URI;
    } else {
      process.env.REACT_APP_BACKEND_URI = originalEnv;
    }
  });

  test('prefers runtime config from window._env_', () => {
    process.env.REACT_APP_BACKEND_URI = 'http://build-time';
    window._env_ = { REACT_APP_BACKEND_URI: 'https://api.example.org' };
    expect(getBackendUri()).toBe('https://api.example.org');
  });

  test('falls back to process.env when runtime value is empty', () => {
    process.env.REACT_APP_BACKEND_URI = 'http://build-time';
    window._env_ = { REACT_APP_BACKEND_URI: '' };
    expect(getBackendUri()).toBe('http://build-time');
  });

  test('falls back to process.env when runtime config is absent', () => {
    process.env.REACT_APP_BACKEND_URI = 'http://build-time';
    expect(getBackendUri()).toBe('http://build-time');
  });

  test('returns undefined when nothing is configured', () => {
    delete process.env.REACT_APP_BACKEND_URI;
    expect(getBackendUri()).toBeUndefined();
  });
});
