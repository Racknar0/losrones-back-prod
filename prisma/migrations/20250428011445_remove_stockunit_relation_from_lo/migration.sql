-- DropForeignKey
ALTER TABLE `stockunitlog` DROP FOREIGN KEY `stockUnitLog_stockUnitId_fkey`;

-- DropIndex
DROP INDEX `stockUnitLog_stockUnitId_fkey` ON `stockunitlog`;
