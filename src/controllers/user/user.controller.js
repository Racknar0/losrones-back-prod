import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../utils/bcryptUtils.js';

const prisma = new PrismaClient();

const TOKENVERSION = process.env.TOKEN_VERSION || 1;

// Create a new user
export const createUser = async (req, res) => {
    const { username, password, name, lastName, roleId, email, storeId } =
        req.body;

    console.log('---- ✅ createUser ----', req.body);

    // Validar que se proporcionen los campos necesarios
    if (!username || !password || !name || !lastName) {
        return res
            .status(400)
            .json({
                message:
                    'Usuario, contraseña, nombre y apellido son requeridos',
            });
    }

    // Si se envió una imagen, la ruta estará en req.file.path
    const profilePicture = req.file ? req.file.path : '';

    try {
        // Verificar que el username no esté registrado
        const existingUser = await prisma.user.findUnique({
            where: { user: username },
        });
        if (existingUser)
            return res
                .status(400)
                .json({ message: 'El nombre de usuario ya está registrado' });

        // Verificar que el email no esté registrado si se proporciona
        if (email) {
            const existingEmail = await prisma.user.findUnique({
                where: { email },
            });
            if (existingEmail)
                return res
                    .status(400)
                    .json({
                        message: 'El correo electrónico ya está registrado',
                    });
        }

        // Encriptar la contraseña
        const passwordHashed = await hashPassword(password);

        // Si el roleId es 2 setear en null el storeId
        let storeIdParsed = parseInt(roleId) === 2 ? null : parseInt(storeId);

        // Crear el usuario en la base de datos
        const newUser = await prisma.user.create({
            data: {
                password: passwordHashed,
                user: username,
                name: name || '',
                lastName: lastName || '',
                roleId: parseInt(roleId) || 1, // Asignar un rol por defecto si no se proporciona
                email: email || null,
                profilePicture, // Guardamos la ruta de la imagen (si se subió)
                storeId: storeIdParsed, // Guardamos el storeId (puede ser null si el rol es 2)
            },
        });

        // Filtrar campos sensibles antes de retornar el usuario
        const { password: _, ...userWithoutPassword } = newUser;
        return res.status(201).json(userWithoutPassword);
    } catch (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({ message: 'Error creating user' });
    }
};

// Get all users
export const getUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            include: {
                role: true, // Incluir la relación con el rol
                store: true, // Incluir la relación con la tienda
            },
            orderBy: {
                store: {
                    name: 'asc', // Ordenar por nombre de la tienda
                },
            },
        });
        res.status(200).json(users);
    } catch (error) {
        console.log('Error getting users: ', error);
        res.status(500).json({ message: 'Error getting users' });
    }
};

// Get user by id
export const getUserById = async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ message: 'Id de user requerido' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: {
                id: parseInt(id),
            },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        console.log('Error getting user: ', error);
        res.status(500).json({ message: 'Error getting user' });
    }
};

// Actualizar usuario (usaremos semánticamente PATCH para actualización parcial)
export const updateUser = async (req, res) => {
    const { id } = req.params;
    const { password, name, lastName, roleId, email, username, storeId } =
        req.body;

    console.log(`---- ✅ updateUser #${id} ----`, req.body);

    // Si se envió una nueva imagen, la ruta estará en req.file.path
    const newProfilePicture = req.file ? req.file.path : '';

    try {
        // Verificar que el usuario existe
        const existingUser = await prisma.user.findUnique({
            where: { id: parseInt(id) },
        });
        if (!existingUser) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Si se envió una nueva imagen, eliminar la imagen anterior (si existe)
        if (req.file && existingUser.profilePicture) {
            const filePath = path.join(
                process.cwd(),
                existingUser.profilePicture
            );
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error('Error al eliminar la imagen anterior:', err);
                    // Puedes optar por continuar o retornar un error, según la lógica que requieras
                }
            });
        }

        // Verificar que el email no esté registrado si se proporciona y es diferente al actual
        if (email && email !== existingUser.email) {
            const existingEmail = await prisma.user.findUnique({
                where: { email },
            });
            if (existingEmail)
                return res
                    .status(400)
                    .json({
                        message: 'El correo electrónico ya está registrado',
                    });
        }

        // Encriptar la contraseña si se proporciona, sino mantener la existente
        let passwordHashed = existingUser.password;
        if (password) {
            passwordHashed = await hashPassword(password);
        }

        // Actualizar el usuario en la base de datos
        const updatedUser = await prisma.user.update({
            where: { id: parseInt(id) },
            data: {
                user: username || existingUser.user,
                password: passwordHashed,
                name: name || existingUser.name,
                lastName: lastName || existingUser.lastName,
                roleId: parseInt(roleId) || existingUser.roleId,
                email: email || existingUser.email,
                profilePicture: req.file
                    ? req.file.path
                    : existingUser.profilePicture,
                storeId:
                    storeId !== undefined
                        ? parseInt(storeId)
                        : existingUser.storeId,
            },
        });

        // Filtrar campos sensibles antes de retornar el usuario
        const { password: _, ...userWithoutPassword } = updatedUser;
        return res.status(200).json(userWithoutPassword);
    } catch (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({ message: 'Error updating user' });
    }
};

// Delete user
export const deleteUser = async (req, res) => {
    const { id } = req.params;

    try {
        // Primero, obtenemos el usuario para saber si tiene imagen
        const user = await prisma.user.findUnique({
            where: { id: parseInt(id) },
        });
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Si el usuario tiene imagen de perfil, eliminarla del almacenamiento
        if (user.profilePicture) {
            // Construir la ruta absoluta al archivo
            const filePath = path.join(process.cwd(), user.profilePicture);
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error('Error al eliminar la imagen:', err);
                    // Puedes decidir si retornar un error o continuar
                }
            });
        }

        // Eliminar el usuario de la base de datos
        const deletedUser = await prisma.user.delete({
            where: {
                id: parseInt(id),
            },
        });

        res.status(200).json(deletedUser);
    } catch (error) {
        console.log('Error al eliminar usuario: ', error);
        res.status(500).json({ message: 'Error al eliminar usuario' });
    }
};
