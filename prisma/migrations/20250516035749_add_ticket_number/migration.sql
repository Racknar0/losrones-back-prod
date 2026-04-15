-- AlterTable
ALTER TABLE `sale` ADD COLUMN `ticketNumber` INTEGER NULL;

-- CreateTable
CREATE TABLE `storesequence` (
    `storeId` INTEGER NOT NULL,
    `nextTicket` INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY (`storeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `storesequence` ADD CONSTRAINT `storesequence_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
