import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getCategories = async (req, res) => {
    try {
        const categories = await prisma.category.findMany();
        return res.status(200).json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        return res
            .status(500)
            .json({ message: 'Error al obtener las categorias' });
    }
};

export const getCategoryById = async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ message: 'Id de categoria requerido' });
    }

    try {
        const category = await prisma.category.findUnique({
            where: {
                id: parseInt(id),
            },
        });

        if (!category) {
            return res.status(404).json({ message: 'Category no encontrado' });
        }
    } catch (error) {
        console.error('Error fetching Category:', error);
        return res
            .status(500)
            .json({ message: 'Error al obtener el Category' });
    }
};

export const createCategory = async (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ message: 'El nombre del Category es requerido' });
    }

    const existingCategory = await prisma.category.findUnique({
        where: { name },
    });

    if (existingCategory) {
        return res.status(400).json({ message: 'La categoria ya existe' });
    }

    try {
        const newCategory = await prisma.category.create({
            data: {
                name,
            },
        });
        return res.status(201).json(newCategory);
    } catch (error) {
        console.error('Error creating categoria:', error);
        return res.status(500).json({ message: 'Error al crear la categoria' });
    }
};

export const updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!id) {
        return res.status(400).json({ message: 'Id de categoria requerido' });
    }

    if (!name) {
        return res
            .status(400)
            .json({ message: 'El nombre del Category es requerido' });
    }

    const existingCategory = await prisma.category.findUnique({
        where: { id: parseInt(id) },
    });

    if (!existingCategory) {
        return res.status(404).json({ message: 'Categoria no encontrada' });
    }

    const categoryWithSameName = await prisma.category.findUnique({
        where: { name },
    });
    if (categoryWithSameName) {
        return res.status(400).json({
            message: 'Estas creando una categoria con un nombre que ya existe',
        });
    }

    try {
        const updatedCategoria = await prisma.category.update({
            where: { id: parseInt(id) },
            data: { name },
        });
        return res.status(200).json(updatedCategoria);
    } catch (error) {
        console.error('Error updating Categoria:', error);
        return res
            .status(500)
            .json({ message: 'Error al actualizar la Categoria' });
    }
};

export const deleteCategory = async (req, res) => {
    const { id } = req.params;
  
    try {
      await prisma.category.delete({
        where: { id: parseInt(id) },
      });
      return res.status(200).json({ message: 'Categoria eliminada con éxito' });
    } catch (error) {
      console.error("Error deleting Categoria:", error);
      return res.status(500).json({ message: "Error al eliminar la Categoria" });
    }
  };

  export default {
    getCategories, 
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
  }
