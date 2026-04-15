-- CreateTable
CREATE TABLE `stockUnitLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockUnitId` INTEGER NOT NULL,
    `productId` INTEGER NULL,
    `storeId` INTEGER NULL,
    `expirationDate` DATE NULL,
    `action` VARCHAR(191) NOT NULL,
    `userId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `stockUnitLog` ADD CONSTRAINT `stockUnitLog_stockUnitId_fkey` FOREIGN KEY (`stockUnitId`) REFERENCES `stockunit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stockUnitLog` ADD CONSTRAINT `stockUnitLog_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stockUnitLog` ADD CONSTRAINT `stockUnitLog_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `store`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stockUnitLog` ADD CONSTRAINT `stockUnitLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
