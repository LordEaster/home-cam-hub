import { PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Create default admin user
  const adminPasswordHash = await bcrypt.hash('changeme123', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      displayName: 'Administrator',
      email: 'admin@localhost',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });
  console.log(`Created admin user: ${admin.username}`);
  console.log('⚠️  Default password is "changeme123" - please change it after first login!');

  // Create default system settings
  const defaultSettings = [
    {
      key: 'recording_retention_days',
      value: 7,
      description: 'Number of days to keep recordings before auto-deletion',
    },
    {
      key: 'max_concurrent_streams',
      value: 10,
      description: 'Maximum number of concurrent stream viewers',
    },
    {
      key: 'motion_detection_sensitivity',
      value: 50,
      description: 'Default motion detection sensitivity (0-100)',
    },
  ];

  for (const setting of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: {
        key: setting.key,
        value: setting.value,
        description: setting.description,
      },
    });
    console.log(`Created setting: ${setting.key}`);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
