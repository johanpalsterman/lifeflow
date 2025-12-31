import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ==================== ASSET CATEGORIES ====================
  const categories = await Promise.all([
    prisma.assetCategory.upsert({
      where: { id: 'cat-vehicle' },
      update: {},
      create: {
        id: 'cat-vehicle',
        name: 'Voertuig',
        icon: 'car',
        color: '#3B82F6',
        defaultMaintenanceIntervalDays: 365,
      },
    }),
    prisma.assetCategory.upsert({
      where: { id: 'cat-home' },
      update: {},
      create: {
        id: 'cat-home',
        name: 'Woning',
        icon: 'home',
        color: '#10B981',
        defaultMaintenanceIntervalDays: 365,
      },
    }),
    prisma.assetCategory.upsert({
      where: { id: 'cat-device' },
      update: {},
      create: {
        id: 'cat-device',
        name: 'Apparaat',
        icon: 'smartphone',
        color: '#8B5CF6',
        defaultMaintenanceIntervalDays: 730,
      },
    }),
    prisma.assetCategory.upsert({
      where: { id: 'cat-household' },
      update: {},
      create: {
        id: 'cat-household',
        name: 'Huishouden',
        icon: 'wrench',
        color: '#F59E0B',
        defaultMaintenanceIntervalDays: 180,
      },
    }),
    prisma.assetCategory.upsert({
      where: { id: 'cat-garden' },
      update: {},
      create: {
        id: 'cat-garden',
        name: 'Tuin',
        icon: 'tree',
        color: '#22C55E',
        defaultMaintenanceIntervalDays: 90,
      },
    }),
  ]);

  console.log(`✅ Created ${categories.length} asset categories`);

  // ==================== MAINTENANCE TYPES ====================
  const maintenanceTypes = await Promise.all([
    // Vehicle
    prisma.maintenanceType.upsert({
      where: { id: 'mt-apk' },
      update: {},
      create: {
        id: 'mt-apk',
        categoryId: 'cat-vehicle',
        name: 'APK Keuring',
        defaultIntervalDays: 365,
        isMandatory: true,
      },
    }),
    prisma.maintenanceType.upsert({
      where: { id: 'mt-vehicle-service' },
      update: {},
      create: {
        id: 'mt-vehicle-service',
        categoryId: 'cat-vehicle',
        name: 'Onderhoud',
        defaultIntervalDays: 365,
        isMandatory: false,
      },
    }),
    prisma.maintenanceType.upsert({
      where: { id: 'mt-tires' },
      update: {},
      create: {
        id: 'mt-tires',
        categoryId: 'cat-vehicle',
        name: 'Banden wisselen',
        defaultIntervalDays: 180,
        isMandatory: false,
      },
    }),
    // Home
    prisma.maintenanceType.upsert({
      where: { id: 'mt-cv-service' },
      update: {},
      create: {
        id: 'mt-cv-service',
        categoryId: 'cat-home',
        name: 'CV Ketel service',
        defaultIntervalDays: 365,
        isMandatory: true,
      },
    }),
    prisma.maintenanceType.upsert({
      where: { id: 'mt-gutter' },
      update: {},
      create: {
        id: 'mt-gutter',
        categoryId: 'cat-home',
        name: 'Dakgoot reinigen',
        defaultIntervalDays: 365,
        isMandatory: false,
      },
    }),
    prisma.maintenanceType.upsert({
      where: { id: 'mt-chimney' },
      update: {},
      create: {
        id: 'mt-chimney',
        categoryId: 'cat-home',
        name: 'Schoorsteen vegen',
        defaultIntervalDays: 365,
        isMandatory: false,
      },
    }),
  ]);

  console.log(`✅ Created ${maintenanceTypes.length} maintenance types`);

  // ==================== RULE CATEGORIES ====================
  const ruleCategories = await Promise.all([
    prisma.ruleCategory.upsert({
      where: { id: 'rc-inbox' },
      update: {},
      create: {
        id: 'rc-inbox',
        name: 'inbox',
        icon: 'mail',
        color: '#06B6D4',
        description: 'Regels voor email en berichten',
      },
    }),
    prisma.ruleCategory.upsert({
      where: { id: 'rc-calendar' },
      update: {},
      create: {
        id: 'rc-calendar',
        name: 'calendar',
        icon: 'calendar',
        color: '#3B82F6',
        description: 'Regels voor agenda en events',
      },
    }),
    prisma.ruleCategory.upsert({
      where: { id: 'rc-financial' },
      update: {},
      create: {
        id: 'rc-financial',
        name: 'financial',
        icon: 'credit-card',
        color: '#8B5CF6',
        description: 'Regels voor facturen en betalingen',
      },
    }),
    prisma.ruleCategory.upsert({
      where: { id: 'rc-maintenance' },
      update: {},
      create: {
        id: 'rc-maintenance',
        name: 'maintenance',
        icon: 'wrench',
        color: '#F59E0B',
        description: 'Regels voor onderhoud en assets',
      },
    }),
    prisma.ruleCategory.upsert({
      where: { id: 'rc-social' },
      update: {},
      create: {
        id: 'rc-social',
        name: 'social',
        icon: 'users',
        color: '#EC4899',
        description: 'Regels voor contacten en verjaardagen',
      },
    }),
    prisma.ruleCategory.upsert({
      where: { id: 'rc-safety' },
      update: {},
      create: {
        id: 'rc-safety',
        name: 'safety',
        icon: 'shield',
        color: '#EF4444',
        description: 'Regels voor backups en security',
      },
    }),
  ]);

  console.log(`✅ Created ${ruleCategories.length} rule categories`);

  console.log('✨ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
