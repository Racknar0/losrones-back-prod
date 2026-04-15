/*
  Warnings:

  - A unique constraint covering the columns `[originalSaleId]` on the table `sale` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `sale` ADD COLUMN `originalSaleId` INTEGER NULL,
    ADD COLUMN `type` VARCHAR(191) NULL DEFAULT 'venta';

-- CreateIndex
CREATE UNIQUE INDEX `sale_originalSaleId_key` ON `sale`(`originalSaleId`);

-- AddForeignKey
ALTER TABLE `sale` ADD CONSTRAINT `sale_originalSaleId_fkey` FOREIGN KEY (`originalSaleId`) REFERENCES `sale`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
