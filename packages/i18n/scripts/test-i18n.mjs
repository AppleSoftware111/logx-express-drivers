import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  resolveLocaleFromAcceptLanguage,
  resolveLocale,
  getApiErrorMessage,
  ApiErrorCode,
  formatMessage,
  formatDateTimeByLocale,
} = require('../dist/index.js');

assert.equal(resolveLocaleFromAcceptLanguage('pt-BR,en;q=0.9'), 'pt');
assert.equal(resolveLocaleFromAcceptLanguage('es-MX,en;q=0.8'), 'es');
assert.equal(resolveLocaleFromAcceptLanguage('en-US'), 'en');
assert.equal(resolveLocale(undefined, undefined), 'pt');
assert.equal(resolveLocale('es', 'en'), 'es');

const ptMsg = getApiErrorMessage(ApiErrorCode.DRIVER_NOT_FOUND, 'pt');
assert.ok(ptMsg.includes('Motorista') || ptMsg.includes('motorista'));

const enMsg = getApiErrorMessage(ApiErrorCode.DRIVER_NOT_FOUND, 'en');
const esMsg = getApiErrorMessage(ApiErrorCode.DRIVER_NOT_FOUND, 'es');
assert.notEqual(ptMsg, enMsg);
assert.notEqual(ptMsg, esMsg);

assert.equal(
  formatMessage('en', 'notifications', 'geofenceDriverArrival', { stopName: 'Lab 1' }),
  'You arrived at Lab 1'
);
assert.notEqual(formatDateTimeByLocale('2026-06-01T10:30:00Z', 'pt'), formatDateTimeByLocale('2026-06-01T10:30:00Z', 'en'));

console.log('i18n unit checks passed');
