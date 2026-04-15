import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Truncar las tablas para reiniciar los AUTO_INCREMENT
  await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 0`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE stockunit`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE product`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE category`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE user`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE store`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE role`);
  await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 1`);

  console.log('✅ Tablas truncadas y reiniciadas');

  // Crear roles con IDs fijos
  await prisma.role.create({ data: { id: 1, name: 'Asesor' } });
  await prisma.role.create({ data: { id: 2, name: 'Admin' } });
  await prisma.role.create({ data: { id: 3, name: 'Moderador' } });

  // Crear tiendas
  await prisma.store.createMany({
    data: [
      {
        name: 'americas',
        address: 'Av. de las Américas 100, Ciudad de México, México',
        phone: '5551234567',
        email: 'contacto@americas.losrones.com',
      },
      {
        name: 'ocampo',
        address: 'Calle Ocampo 200, Guadalajara, México',
        phone: '5559876543',
        email: 'contacto@ocampo.losrones.com',
      },
      {
        name: 'xalapacrystal',
        address: 'Crystal Ave 300, Monterrey, México',
        phone: '5555555555',
        email: 'contacto@xalapacrystal.losrones.com',
      },
      {
        name: 'mocambo',
        address: 'Boulevard Mocambo 400, Puebla, México',
        phone: '5551112222',
        email: 'contacto@mocambo.losrones.com',
      },
    ],
  });

  // Crear categorías
  await prisma.category.createMany({
    data: [
      { name: 'Camas' },
      { name: 'Alimentos' },
    ],
  });

  // Crear usuarios con role y store
  await prisma.user.createMany({
    data: [
      {
        user: 'racknaro',
        password: '$2b$10$m5SfmMdTJZHdq7hJr94f5u/L6hhoEPLUfdRjgvjTfCtOlHnUDXWkq',
        email: 'correo@correo.com',
        name: 'Jonathan',
        lastName: 'Torres',
        profilePicture: 'uploads\\profiles\\1743693072531-523457826-b9b95883-2111-426c-ad18-0638b52e471d.png',
        lastLogin: new Date('2025-04-08T14:37:41.032Z'),
        jwtVersion: 1,
        isActive: true,
        roleId: 2, // Admin
      },
      {
        user: 'racknaro_asesor',
        password: '$2b$10$GyrrjYNiqrhVUOSVsJ0X2uiIoFXITjxNSVcjUMpZBJsd34uU6QwuW',
        email: '',
        name: 'Jonathan',
        lastName: 'Torres',
        profilePicture: '',
        jwtVersion: 1,
        isActive: true,
        roleId: 1, // Asesor
        storeId: 2, // Ocampo
      },
    ],
  });

  console.log('✅ Roles, tiendas, categorías y usuarios creados con éxito');
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
