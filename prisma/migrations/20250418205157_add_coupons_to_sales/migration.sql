-- AlterTable
ALTER TABLE `sale` ADD COLUMN `couponCode` VARCHAR(191) NULL,
    ADD COLUMN `totalWithoutCoupon` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `saleitem` ADD COLUMN `itemCouponCode` VARCHAR(191) NULL;
