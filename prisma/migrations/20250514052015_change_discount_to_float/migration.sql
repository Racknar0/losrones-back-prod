/*
  Warnings:

  - You are about to alter the column `discount` on the `coupon` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.

*/
-- AlterTable
ALTER TABLE `coupon` MODIFY `discount` DOUBLE NOT NULL;
