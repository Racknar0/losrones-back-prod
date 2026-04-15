-- CreateTable
CREATE TABLE `corte` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `folioInicial` INTEGER NOT NULL,
    `folioFinal` INTEGER NOT NULL,
    `ventaTotal` DECIMAL(10, 2) NOT NULL,
    `costoTotal` DECIMAL(10, 2) NOT NULL,
    `efectivo` DECIMAL(10, 2) NOT NULL,
    `tarjeta` DECIMAL(10, 2) NOT NULL,
    `transferencia` DECIMAL(10, 2) NOT NULL,
    `ingresoInterno` DECIMAL(10, 2) NULL,
    `apartados` DECIMAL(10, 2) NULL,
    `comentarios` VARCHAR(191) NULL,
    `userId` INTEGER NOT NULL,
    `storeId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `corte` ADD CONSTRAINT `corte_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `corte` ADD CONSTRAINT `corte_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
