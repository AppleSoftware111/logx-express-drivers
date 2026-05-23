import 'dotenv/config';

import { connectDB, disconnectDB } from '../config/db';
import { env } from '../config/env';
import { hashPassword } from '../modules/auth/auth.service';
import { Company } from '../models/Company.model';
import { User } from '../models/User.model';

async function seed(): Promise<void> {
  await connectDB();

  const email = env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@logxexpress.com';
  const password = env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const existing = await User.findOne({ email }).lean();
  if (existing) {
    console.info('[seed] SUPER_ADMIN already exists, skipping');
    await disconnectDB();
    return;
  }

  // Create a default company for super admin
  const company = await Company.create({
    name: 'LOGX Express (HQ)',
    isActive: true,
  });

  await User.create({
    companyId: company._id,
    email,
    passwordHash: await hashPassword(password),
    role: 'SUPER_ADMIN',
    isActive: true,
  });

  console.info(`[seed] ✅ SUPER_ADMIN created: ${email}`);
  console.info('[seed] ⚠️  Change the password immediately after first login!');

  await disconnectDB();
}

seed().catch((err) => {
  console.error('[seed] Error:', err);
  process.exit(1);
});
