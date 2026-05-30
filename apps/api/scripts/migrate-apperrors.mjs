import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const replacements = [
  ["throw new AppError('Invalid email or password', 401)", 'throw new AppError(ApiErrorCode.AUTH_INVALID_CREDENTIALS, 401)'],
  ["throw new AppError('Vehicle not found', 404)", 'throw new AppError(ApiErrorCode.VEHICLE_NOT_FOUND, 404)'],
  ["throw new AppError('A vehicle with this plate already exists', 409)", 'throw new AppError(ApiErrorCode.PLATE_ALREADY_EXISTS, 409)'],
  ["throw new AppError('Plate already in use', 409)", 'throw new AppError(ApiErrorCode.PLATE_ALREADY_EXISTS, 409)'],
  ["throw new AppError('Execution not found', 404)", 'throw new AppError(ApiErrorCode.EXECUTION_NOT_FOUND, 404)'],
  ["throw new AppError('Cannot substitute driver on a completed or cancelled execution', 400)", 'throw new AppError(ApiErrorCode.EXECUTION_CANNOT_SUBSTITUTE, 400)'],
  ["throw new AppError('Stop not found', 404)", 'throw new AppError(ApiErrorCode.STOP_NOT_FOUND, 404)'],
  ["throw new AppError('Stop must be in ARRIVED status before starting', 400)", 'throw new AppError(ApiErrorCode.STOP_MUST_BE_ARRIVED, 400)'],
  ["throw new AppError('Stop must be ARRIVED or IN_PROGRESS to complete', 400)", 'throw new AppError(ApiErrorCode.STOP_MUST_BE_ARRIVED_OR_IN_PROGRESS, 400)'],
  ["throw new AppError('Branch not found', 404)", 'throw new AppError(ApiErrorCode.BRANCH_NOT_FOUND, 404)'],
  ["throw new AppError('At least one file (photo or signature) is required', 400)", 'throw new AppError(ApiErrorCode.POD_FILE_REQUIRED, 400)'],
  ["throw new AppError('key query parameter is required', 400)", 'throw new AppError(ApiErrorCode.POD_KEY_REQUIRED, 400)'],
  ["throw new AppError('Client not found', 404)", 'throw new AppError(ApiErrorCode.CLIENT_NOT_FOUND, 404)'],
  ["throw new AppError('Email and password required for portal user', 400)", 'throw new AppError(ApiErrorCode.CLIENT_PORTAL_CREDENTIALS_REQUIRED, 400)'],
  ["throw new AppError('Email already in use', 409)", 'throw new AppError(ApiErrorCode.EMAIL_ALREADY_IN_USE, 409)'],
  ["throw new AppError('Contract not found', 404)", 'throw new AppError(ApiErrorCode.CONTRACT_NOT_FOUND, 404)'],
  ["throw new AppError('End date must be after start date', 400)", 'throw new AppError(ApiErrorCode.CONTRACT_END_BEFORE_START, 400)'],
  ["throw new AppError('Email and password required to create user account', 400)", 'throw new AppError(ApiErrorCode.DRIVER_EMAIL_PASSWORD_REQUIRED, 400)'],
  ["throw new AppError('Driver not found', 404)", 'throw new AppError(ApiErrorCode.DRIVER_NOT_FOUND, 404)'],
  ["throw new AppError('Company not found', 404)", 'throw new AppError(ApiErrorCode.COMPANY_NOT_FOUND, 404)'],
  ["throw new AppError('A company with this CNPJ already exists', 409)", 'throw new AppError(ApiErrorCode.CNPJ_ALREADY_EXISTS, 409)'],
  ["throw new AppError('CNPJ already in use', 409)", 'throw new AppError(ApiErrorCode.CNPJ_ALREADY_EXISTS, 409)'],
  ["throw new AppError('Route not found', 404)", 'throw new AppError(ApiErrorCode.ROUTE_NOT_FOUND, 404)'],
];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(p));
    else if (entry.name.endsWith('.ts')) files.push(p);
  }
  return files;
}

import { readdirSync } from 'node:fs';

for (const file of walk(root)) {
  if (!file.includes('.service.') && !file.includes('pod.routes')) continue;
  let content = readFileSync(file, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }
  if (content.includes('throw new AppError(`Stop is already in status:')) {
    content = content.replace(
      /throw new AppError\(`Stop is already in status: \$\{stop\.status\}`\s*,\s*400\)/g,
      'throw new AppError(ApiErrorCode.STOP_ALREADY_STATUS, 400, { status: stop.status })'
    );
    changed = true;
  }
  if (changed) {
    if (!content.includes("from '@logx/i18n'") && content.includes('ApiErrorCode')) {
      content = content.replace(
        /import { AppError } from '\.\.\/\.\.\/middleware\/errorHandler';/,
        "import { ApiErrorCode } from '@logx/i18n';\n\nimport { AppError } from '../../middleware/errorHandler';"
      );
      content = content.replace(
        /import { AppError } from '\.\.\/\.\.\/\.\.\/middleware\/errorHandler';/,
        "import { ApiErrorCode } from '@logx/i18n';\n\nimport { AppError } from '../../../middleware/errorHandler';"
      );
    }
    writeFileSync(file, content);
    console.log('updated', file);
  }
}
