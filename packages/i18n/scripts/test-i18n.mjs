import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  resolveLocaleFromAcceptLanguage,
  resolveLocale,
  getApiErrorMessage,
  ApiErrorCode,
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

console.log('i18n unit checks passed');
