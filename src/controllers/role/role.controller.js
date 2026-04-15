import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all roles
export const getRoles = async (req, res) => {
    try {
        const roles = await prisma.role.findMany();
        return res.status(200).json(roles);
    } catch (error) {
        console.error('Error fetching roles:', error);
        return res.status(500).json({ message: 'Error al obtener los roles' });
    }
};

// Get role by id
export const getRoleById = async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ message: 'Id de Rol requerido' });
    }

    try {
        const role = await prisma.role.findUnique({
            where: {
                id: parseInt(id),
            },
        });

        if (!role) {
            return res.status(404).json({ message: 'Rol no encontrado' });
        }
        return res.status(200).json(role);
    } catch (error) {
        console.error('Error fetching role:', error);
        return res.status(500).json({ message: 'Error al obtener el rol' });
    }
};

// Create a new role
export const createRole = async (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res
            .status(400)
            .json({ message: 'El nombre del rol es requerido' });
    }

    // Check if the role already exists
    const existingRole = await prisma.role.findUnique({
        where: { name },
    });

    if (existingRole) {
        return res.status(400).json({ message: 'El rol ya existe' });
    }

    try {
        const newRole = await prisma.role.create({
            data: {
                name,
            },
        });
        return res.status(201).json(newRole);
    } catch (error) {
        console.error('Error creating role:', error);
        return res.status(500).json({ message: 'Error al crear el rol' });
    }
};

// Update a role
export const updateRole = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!id) {
        return res.status(400).json({ message: 'Id de Rol requerido' });
    }

    if (!name) {
        return res
            .status(400)
            .json({ message: 'El nombre del rol es requerido' });
    }

    // Check if the role exists
    const existingRole = await prisma.role.findUnique({
        where: { id: parseInt(id) },
    });
    if (!existingRole) {
        return res.status(404).json({ message: 'Rol no encontrado' });
    }

    // Check if the new role name already exists
    const roleWithSameName = await prisma.role.findUnique({
        where: { name },
    });
    if (roleWithSameName) {
        return res
            .status(400)
            .json({
                message: 'Estas creando un rol con un nombre que ya existe',
            });
    }

    try {
        const updatedRole = await prisma.role.update({
            where: { id: parseInt(id) },
            data: { name },
        });
        return res.status(200).json(updatedRole);
    } catch (error) {
        console.error('Error updating role:', error);
        return res.status(500).json({ message: 'Error al actualizar el rol' });
    }
};

// Delete a role
export const deleteRole = async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.role.delete({
            where: { id: parseInt(id) },
        });
        return res.status(200).json({ message: 'Rol eliminado con éxito' });
    } catch (error) {
        console.error('Error deleting role:', error);
        return res.status(500).json({ message: 'Error al eliminar el rol' });
    }
};

// Export all functions for use in routes
export default {
    getRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole,
};
