import type { ZodErrorMap } from 'zod';
import { z } from 'zod';

import type { SupportedLocale } from './locales';
import { translateValidationKey } from './messages';

const defaultIssueCodes: Record<string, string> = {
  invalid_type: 'validation.invalidType',
  invalid_literal: 'validation.invalidLiteral',
  unrecognized_keys: 'validation.unrecognizedKeys',
  invalid_union: 'validation.invalidUnion',
  invalid_union_discriminator: 'validation.invalidUnionDiscriminator',
  invalid_enum_value: 'validation.invalidEnum',
  invalid_arguments: 'validation.invalidArguments',
  invalid_return_type: 'validation.invalidReturnType',
  invalid_date: 'validation.invalidDate',
  invalid_string: 'validation.invalidString',
  too_small: 'validation.tooSmall',
  too_big: 'validation.tooBig',
  invalid_intersection_types: 'validation.invalidIntersection',
  not_multiple_of: 'validation.notMultipleOf',
  not_finite: 'validation.notFinite',
  custom: 'validation.custom',
};

function resolveMessage(locale: SupportedLocale, message: string | undefined): string | undefined {
  if (!message) return undefined;
  if (message.startsWith('validation.')) {
    return translateValidationKey(locale, message);
  }
  const translated = translateValidationKey(locale, `validation.${message}`);
  if (translated !== `validation.${message}`) return translated;
  return message;
}

export function createZodErrorMap(locale: SupportedLocale): ZodErrorMap {
  return (issue, ctx) => {
    if (issue.message) {
      const custom = resolveMessage(locale, issue.message);
      if (custom) return { message: custom };
    }

    const key = defaultIssueCodes[issue.code];
    if (key) {
      const msg = translateValidationKey(locale, key);
      if (msg !== key) return { message: msg };
    }

    return { message: ctx.defaultError };
  };
}

export function setZodLocale(locale: SupportedLocale): void {
  z.setErrorMap(createZodErrorMap(locale));
}
