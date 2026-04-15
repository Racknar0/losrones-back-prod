import { PrismaClient } from '@prisma/client';
import { transporter } from '../nodemailer/nodeMailerController.js';
import { comparePassword, hashPassword } from '../../utils/bcryptUtils.js';
import { generateRandomToken } from '../../utils/cryptoUtils.js';
import { generateJWT } from '../../utils/jwtUtils.js';

const prisma = new PrismaClient();

// register a new user
export const register = async (req, res) => {
    const { user, password, name, lastName } = req.body;

    if (!user || !password || !name || !lastName) {
        return res.status(400).json({ message: 'Please fill all fields' });
    }

    try {
        // Verificar que el user no esté registrado
        const existingUser = await prisma.user.findUnique({
            where: {
                user,
            },
        });
        if (existingUser)
            return res.status(400).json({ message: 'User already exists' });

        // Encriptar la contraseña
        const hashedPassword = await hashPassword(password);

        // Crear el usuario em la base de datos
        const newUser = await prisma.user.create({
            data: {
                user,
                password: hashedPassword,
                name,
                lastName,
                roleId: 1,
            },
        });

        // Retornar el usuario creado (sin la contraseña)
        return res.status(201).json({
            message: 'Registration successful',
            user: newUser,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// login a user
export const login = async (req, res) => {
    const { username, password, tienda } = req.body;

    // Validar que se proporcione un username, una contraseña y una tienda
    if (!username || !password || !tienda) {
        return res
            .status(400)
            .json({ message: 'Por favor, complete todos los campos' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { user: username },
        });

        if (!user) {
            console.error('User not found');
            return res.status(400).json({ message: 'Credenciales inválidas' });
        }

        // Comprar la contraseña proporcionada con la almacenada en la base de datos
        const passwordMatch = await comparePassword(password, user.password);

        if (!passwordMatch) {
            return res.status(400).json({ message: 'Credenciales inválidas' });
        }

        // Verificar si el usuario está activo
        if (!user.isActive) {
            return res
                .status(400)
                .json({
                    message:
                        'El usuario está inactivo porfavor contacta al administrador',
                });
        }

        // obtener el nombre del rol
        const role = await prisma.role.findUnique({
            where: { id: user.roleId },
        });
        if (!role) {
            return res.status(400).json({ message: 'Rol no encontrado' });
        }

        // Si el rol es diferente a 2, verificar que la tienda a la que me logeo sea asignado al usuario
        if (role.id !== 2) {
            console.log('user.store', user.storeId);
            console.log('tienda', tienda);
            if (parseInt(user.storeId) !== parseInt(tienda)) {
                return res
                    .status(400)
                    .json({ message: 'No tienes acceso a esta tienda' });
            }
        }

        const loginStore = await prisma.store.findUnique({
            where: { id: Number(tienda) },
        });

        if (!loginStore) {
            return res.status(400).json({ message: 'Tienda no encontrada' });
        }

        if (!loginStore.isActive) {
            return res.status(400).json({ message: 'La tienda está inactiva' });
        }

        // Verificar si el usuario tiene una tienda asignada (si el rol no es 2)
        let storeAssigned = null;
        if (user.storeId) {
            storeAssigned = await prisma.store.findUnique({
                where: { id: user.storeId },
            });
            if (!storeAssigned || !storeAssigned.isActive) {
                storeAssigned = null; // Si no se encuentra la tienda, asignar null
            }
        }

        // Crear un token de autenticación
        // const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        const token = generateJWT({
            id: user.id,
            username: user.user,
            roleId: user.roleId,
            userImage: user.profilePicture,
            name: user.name,
            lastName: user.lastName,
            role: role.name,
            store: storeAssigned,
            // tienda a la que me logeo
            storeLogin: tienda,
        });

        // Opcional: Establecer el token en una cookie httpOnly
        // res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

        // Setear el lastLogin en la base de datos
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
        });

        // Retornar el token y el usuario (sin la contraseña)
        return res.status(200).json({ message: 'Login successful', token });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
