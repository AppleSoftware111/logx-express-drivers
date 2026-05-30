import type { CreateClientInput, UpdateClientInput } from '@logx/shared';
import { UserRole } from '@logx/shared';

import { ApiErrorCode } from '@logx/i18n';

import { AppError } from '../../middleware/errorHandler';
import { Client } from '../../models/Client.model';
import { User } from '../../models/User.model';
import { hashPassword } from '../auth/auth.service';

export async function listClients(companyId: string, type?: string) {
  const filter: Record<string, unknown> = { companyId, isActive: true };
  if (type) filter.type = type;

  return Client.find(filter)
    .select('-__v')
    .populate('userId', 'email isActive')
    .lean()
    .sort({ name: 1 });
}

export async function getClient(companyId: string, clientId: string) {
  const client = await Client.findOne({ companyId, _id: clientId })
    .select('-__v')
    .populate('userId', 'email isActive')
    .lean();
  if (!client) throw new AppError(ApiErrorCode.CLIENT_NOT_FOUND, 404);
  return client;
}

export async function createClient(companyId: string, data: CreateClientInput) {
  let userId: string | undefined;

  if (data.createPortalUser) {
    if (!data.portalEmail || !data.portalPassword) {
      throw new AppError(ApiErrorCode.CLIENT_PORTAL_CREDENTIALS_REQUIRED, 400);
    }

    const existing = await User.findOne({ email: data.portalEmail.toLowerCase() }).lean();
    if (existing) throw new AppError(ApiErrorCode.EMAIL_ALREADY_IN_USE, 409);

    const user = await User.create({
      companyId,
      email: data.portalEmail.toLowerCase(),
      passwordHash: await hashPassword(data.portalPassword),
      role: UserRole.CLIENT,
    });
    userId = user._id.toString();
  }

  const client = await Client.create({
    companyId,
    name: data.name,
    cnpj: data.cnpj,
    address: data.address,
    location: { type: 'Point', coordinates: [data.lng, data.lat] },
    type: data.type,
    userId,
  });

  if (userId) {
    await User.findByIdAndUpdate(userId, { clientId: client._id });
  }

  return client.toObject();
}

export async function updateClient(
  companyId: string,
  clientId: string,
  data: UpdateClientInput
) {
  const update: Record<string, unknown> = { ...data };
  if (data.lat !== undefined && data.lng !== undefined) {
    update.location = { type: 'Point', coordinates: [data.lng, data.lat] };
    delete update.lat;
    delete update.lng;
  }

  const client = await Client.findOneAndUpdate(
    { companyId, _id: clientId },
    { $set: update },
    { new: true }
  ).lean();
  if (!client) throw new AppError(ApiErrorCode.CLIENT_NOT_FOUND, 404);
  return client;
}

export async function deactivateClient(companyId: string, clientId: string) {
  const client = await Client.findOneAndUpdate(
    { companyId, _id: clientId },
    { isActive: false },
    { new: true }
  ).lean();
  if (!client) throw new AppError(ApiErrorCode.CLIENT_NOT_FOUND, 404);
  return client;
}
