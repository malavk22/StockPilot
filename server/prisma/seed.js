// server/prisma/seed.js
//
// Seeds exactly one ADMIN account. This is intentional: self-registration
// (POST /auth/register) only ever creates STAFF users — there is no
// client-controlled path to ADMIN. The first admin has to come from here
// (or, later, be promoted by an existing admin via a dedicated endpoint).

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin12345', 10);

  await prisma.user.upsert({
    where: { email: 'admin@stockpilot.dev' },
    // update role too, not just the password — otherwise re-running this
    // seed against a row that was previously created some other way (e.g.
    // self-registration, which always creates STAFF) silently leaves it
    // as STAFF instead of enforcing ADMIN.
    update: { passwordHash, role: 'ADMIN' },
    create: {
      email: 'admin@stockpilot.dev',
      firstName: 'System',
      lastName: 'Admin',
      passwordHash,
      role: 'ADMIN',
    },
  });

  await prisma.warehouse.upsert({
    where: { name: 'Main Warehouse' },
    update: {},
    create: {
      name: 'Main Warehouse',
      location: 'Default location',
    },
  });

  console.log('✅ Database seeded: 1 admin user, 1 default warehouse');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
