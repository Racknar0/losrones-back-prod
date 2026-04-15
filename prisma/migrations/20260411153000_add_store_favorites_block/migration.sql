-- CreateTable
CREATE TABLE `storefavoriteblockcategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `storeCategoryId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `storefavoriteblockcategory_storeCategoryId_key`(`storeCategoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `storefavoriteblockitem` (
    `favoriteCategoryId` INTEGER NOT NULL,
    `storeItemId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `storefavoriteblockitem_storeItemId_idx`(`storeItemId`),
    PRIMARY KEY (`favoriteCategoryId`, `storeItemId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `storefavoriteblockcategory` ADD CONSTRAINT `storefavoriteblockcategory_storeCategoryId_fkey` FOREIGN KEY (`storeCategoryId`) REFERENCES `storecategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `storefavoriteblockitem` ADD CONSTRAINT `storefavoriteblockitem_favoriteCategoryId_fkey` FOREIGN KEY (`favoriteCategoryId`) REFERENCES `storefavoriteblockcategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `storefavoriteblockitem` ADD CONSTRAINT `storefavoriteblockitem_storeItemId_fkey` FOREIGN KEY (`storeItemId`) REFERENCES `storeitem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
