-- AlterEnum
ALTER TYPE "CameraType" ADD VALUE 'GENERIC';

-- AlterTable
ALTER TABLE "system_settings" ALTER COLUMN "updated_at" DROP DEFAULT;
