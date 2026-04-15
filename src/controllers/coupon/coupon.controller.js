import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// POST /coupons
export const createCoupon = async (req, res) => {
    const { code, description, discount } = req.body;

    const descuento = parseFloat(discount);

    // Validar datos de entrada
    if (!code || !description || isNaN(descuento)) {
        return res.status(400).json({ error: 'Faltan datos requeridos o descuento inválido' });
    }
    if (descuento <= 0) {
        return res.status(400).json({ error: 'El descuento debe ser un número positivo' });
    }
    if (descuento > 100) {
        return res.status(400).json({ error: 'El descuento no puede ser mayor a 100' });
    }

    // Verificar si el cupón ya existe
    const existingCoupon = await prisma.coupon.findUnique({ where: { code } });
    if (existingCoupon) {
        return res.status(400).json({ error: 'El cupón ya existe' });
    }


    try {
        const coupon = await prisma.coupon.create({
            data: { 
                code, 
                description, 
                discount: descuento,
            },
        });
        return res.status(201).json(coupon);
    } catch (err) {
        console.error(err);
        return res.status(400).json({ error: 'No se pudo crear el cupón' });
    }
};

// GET /coupons
export const getCoupons = async (req, res) => {
    try {
        const list = await prisma.coupon.findMany({ orderBy: { id: 'asc' } });
        return res.json(list);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al obtener los cupones' });
    }
};

// DELETE /coupons/:id
export const deleteCoupon = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    try {
        await prisma.coupon.delete({ where: { id } });
        return res.json({ message: 'Cupón eliminado' });
    } catch (err) {
        console.error(err);
        return res.status(404).json({ error: 'Cupón no encontrado' });
    }
};
