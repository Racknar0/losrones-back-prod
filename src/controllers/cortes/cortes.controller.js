import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const prisma = new PrismaClient();

// Para recrear __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper: devuelve la fecha de hoy en "YYYY-MM-DD"
function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

// Helper para convertir milímetros a puntos (PDFKit usa pt)
const mmToPt = (mm) => mm * 2.83465; // 1 mm ≃ 2.83465 pt

// GET /api/cortes/summary?storeId=#
export const getDailyCorte = async (req, res) => {
    try {
        // 1) Calculamos "hoy" en hora local
        const now = new Date(); // p.ej. 2025-05-13T23:07:00 GMT-0500
        const year = now.getFullYear(); // 2025
        const month = now.getMonth(); // 4  (0=enero,…,4=mayo)
        const day = now.getDate(); // 13

        // 2) Creamos los límites del día en local:
        const startLocal = new Date(year, month, day, 0, 0, 0, 0);
        const endLocal = new Date(year, month, day, 23, 59, 59, 999);
        // Internamente serán serializados a UTC al ejecutar el query

        // 3) Obtenemos el storeId de la query o del token
        const storeId = req.query.storeId
            ? parseInt(req.query.storeId, 10)
            : req.user.storeId;

        if (!storeId) {
            return res.status(400).json({
                error: 'Falta storeId en query o en el token.',
            });
        }

        // 4) Traemos ventas del día (UTC) que equivalen al "hoy local"
        const ventas = await prisma.sale.findMany({
            where: {
                storeId,
                isDeleted: false, // Aseguramos que no sean ventas eliminadas
                createdAt: {
                    gte: startLocal,
                    lte: endLocal,
                },
            },
            include: {
                saleItems: {
                    include: { product: true },
                },
            },
        });

        // 5) Si no hay ventas, devolvemos ceros/null
        if (ventas.length === 0) {
            // Reconstruimos dateString para la respuesta
            const dateString = `${year}-${String(month + 1).padStart(
                2,
                '0'
            )}-${String(day).padStart(2, '0')}`;
            return res.json({
                date: dateString,
                folioInicial: null,
                folioFinal: null,
                ventaTotal: 0,
                costoTotal: 0,
                efectivo: 0,
                tarjeta: 0,
                transferencia: 0,
                ingresoTotal: 0,
                ingresoInterno: null,
                apartados: null,
                comentarios: null,
            });
        }

        // 6) Cálculos de corte
        const ids = ventas.map((v) => v.id);
        const folioInicial = Math.min(...ids);
        const folioFinal = Math.max(...ids);

        const ventaTotal = ventas.reduce(
            (sum, v) => sum + Number(v.totalAmount),
            0
        );

        const costoTotal = ventas.reduce(
            (sum, v) =>
                sum +
                v.saleItems.reduce(
                    (s, item) => s + Number(item.product.purchasePrice),
                    0
                ),
            0
        );

        const sumByMethod = (method) =>
            ventas
                .filter((v) => v.paymentMethod === method)
                .reduce((a, v) => a + Number(v.totalAmount), 0);

        const efectivo = sumByMethod('efectivo');
        const tarjeta = sumByMethod('tarjeta');
        const transferencia = sumByMethod('transferencia');
        const ingresoTotal = efectivo + tarjeta + transferencia;
        const ingresoInterno = ventas
            .filter((v) => v.type === 'cambio')
            .reduce((sum, v) => sum + Number(v.totalAmount), 0);

        // 7) Devolvemos el JSON de resumen
        const dateString = `${year}-${String(month + 1).padStart(
            2,
            '0'
        )}-${String(day).padStart(2, '0')}`;
        return res.json({
            date: dateString,
            folioInicial,
            folioFinal,
            ventaTotal,
            costoTotal,
            efectivo,
            tarjeta,
            transferencia,
            ingresoTotal,
            ingresoInterno,
            apartados: null,
            comentarios: null,
        });
    } catch (error) {
        console.error('GET /api/cortes/summary →', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// POST /api/cortes
export const createTodayCorte = async (req, res) => {
    try {
        // 1) Calculamos "hoy" en hora local
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0 = Enero … 4 = Mayo
        const day = now.getDate();

        // 2) Date-only (para el campo DATE) y rango completo DEL DÍA en local
        const dateOnly = new Date(year, month, day); // 00:00:00.000 local
        const startLocal = new Date(year, month, day, 0, 0, 0, 0);
        const endLocal = new Date(year, month, day, 23, 59, 59, 999);

        const userId = req.user.id;
        const { comentarios = null, storeId: rawStoreId } = req.body;
        if (!rawStoreId) {
            return res
                .status(400)
                .json({
                    error: 'Debe enviarse en el body el campo "storeId".',
                });
        }
        const storeId = parseInt(rawStoreId, 10);
        if (Number.isNaN(storeId)) {
            return res
                .status(400)
                .json({ error: '"storeId" debe ser un número válido.' });
        }

        console.log('storeId', storeId);
        console.log('dateOnly', dateOnly);
        // Extraigo YYYY-MM-DD…
        const dateStringMatch = dateOnly.toISOString().split('T')[0];
        // …y lo convierto a un JS Date (medianoche UTC):
        const dateForMatch = new Date(dateStringMatch);
        const exists = await prisma.corte.findFirst({
            where: { storeId, date: dateForMatch },
        });

        console.log('exists', exists);

        if (exists) {
            return res
                .status(409)
                .json({
                    error: 'El corte de hoy ya fue guardado para esta tienda.',
                });
        }

        // 4) Recalculamos ventas ENTRE startLocal y endLocal (hora local)
        const ventas = await prisma.sale.findMany({
            where: {
                storeId,
                isDeleted: false, // Aseguramos que no sean ventas eliminadas
                createdAt: { gte: startLocal, lte: endLocal },
            },
            include: { saleItems: { include: { product: true } } },
        });

        // 5) Agregamos lógicas de folios y totales…
        const ids = ventas.map((v) => v.id);
        const folioInicial = ventas.length ? Math.min(...ids) : null;
        const folioFinal = ventas.length ? Math.max(...ids) : null;
        const ventaTotal = ventas.reduce(
            (s, v) => s + Number(v.totalAmount),
            0
        );
        const costoTotal = ventas.reduce(
            (s, v) =>
                s +
                v.saleItems.reduce(
                    (sum, item) => sum + Number(item.product.purchasePrice),
                    0
                ),
            0
        );
        const sumByMethod = (m) =>
            ventas
                .filter((v) => v.paymentMethod === m)
                .reduce((a, v) => a + Number(v.totalAmount), 0);

        const efectivo = sumByMethod('efectivo');
        const tarjeta = sumByMethod('tarjeta');
        const transferencia = sumByMethod('transferencia');
        const ingresoInterno = ventas
            .filter((v) => v.type === 'cambio')
            .reduce((sum, v) => sum + Number(v.totalAmount), 0);

        // 6) Creamos el corte usando dateOnly para el campo DATE
        const corte = await prisma.corte.create({
            data: {
                date: dateOnly,
                folioInicial,
                folioFinal,
                ventaTotal,
                costoTotal,
                efectivo,
                tarjeta,
                transferencia,
                ingresoInterno,
                apartados: null,
                comentarios,
                userId,
                storeId,
            },
        });

        // 7) Respondemos
        return res.status(201).json({
            id: corte.id,
            date: `${year}-${String(month + 1).padStart(2, '0')}-${String(
                day
            ).padStart(2, '0')}`,
            folioInicial,
            folioFinal,
            ventaTotal: Number(corte.ventaTotal),
            costoTotal: Number(corte.costoTotal),
            efectivo: Number(corte.efectivo),
            tarjeta: Number(corte.tarjeta),
            transferencia: Number(corte.transferencia),
            ingresoTotal: efectivo + tarjeta + transferencia,
            ingresoInterno:
                corte.ingresoInterno != null
                    ? Number(corte.ingresoInterno)
                    : null,
            apartados: corte.apartados != null ? Number(corte.apartados) : null,
            comentarios: corte.comentarios,
        });
    } catch (error) {
        console.error('POST /api/cortes →', error);
        return res.status(500).json({ error: 'No se pudo guardar el corte.' });
    }
};

// DELETE /api/cortes
export const deleteTodayCorte = async (req, res) => {
    try {
        // 1) Calculamos "hoy" en hora local
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0 = Enero … 4 = Mayo
        const day = now.getDate(); // día del mes local

        // 2) Creamos el "dateOnly" tal cual lo hace createTodayCorte:
        //    new Date(year, month, day) representa la medianoche local
        const dateOnly = new Date(year, month, day);

        // 3) Validamos storeId
        const { storeId: rawStoreId } = req.body;
        if (!rawStoreId) {
            return res.status(400).json({
                error: 'Debe enviarse en el body el campo "storeId".',
            });
        }
        const storeId = parseInt(rawStoreId, 10);
        if (Number.isNaN(storeId)) {
            return res.status(400).json({
                error: '"storeId" debe ser un número válido.',
            });
        }

        // Extraigo YYYY-MM-DD para comparar directamente con el DATE
        const dateStringMatch = dateOnly.toISOString().split('T')[0]; // "2025-05-13"
        const dateForMatch = new Date(dateStringMatch); // => 2025-05-13T00:00:00.000Z
        const { count } = await prisma.corte.deleteMany({
            where: { storeId, date: dateForMatch },
        });

        console.log('count ------------>', count);

        if (count === 0) {
            return res.status(404).json({
                error: 'No se encontró ningún corte de hoy para eliminar.',
            });
        }

        console.log('DELETE /api/cortes');

        return res.json({ message: 'Corte de hoy eliminado' });
    } catch (err) {
        console.log('err DELETE /api/cortes →');
        console.error(err);
        return res.status(500).json({ error: 'Error al eliminar corte.', err });
    }
};

// POST /api/cortes/range
export const getCortesByRange = async (req, res) => {
    try {
        let { storeId, fechaInicial, fechaFinal } = req.body;

        // 1) Validar storeId
        if (!storeId || isNaN(parseInt(storeId, 10))) {
            return res.status(400).json({
                error: 'Debe proporcionarse un "storeId" válido en el cuerpo de la solicitud.',
            });
        }
        const storeIdInt = parseInt(storeId, 10);

        // 2) Construir filtro base
        const filter = { storeId: storeIdInt };

        // 3) Si recibimos fechas, convertirlas y filtrar por igualdad o rango
        if (fechaInicial && fechaFinal) {
            // Desglosamos las partes YYYY-MM-DD
            const [yI, mI, dI] = fechaInicial.split('-').map(Number);
            const [yF, mF, dF] = fechaFinal.split('-').map(Number);

            if (fechaInicial === fechaFinal) {
                // Caso: misma fecha → buscar exactamente ese día (UTC midnight)
                // Ejemplo: "2025-06-04" → new Date("2025-06-04T00:00:00.000Z")
                const fechaExactaUTC = new Date(
                    Date.UTC(yI, mI - 1, dI, 0, 0, 0, 0)
                );
                filter.date = { equals: fechaExactaUTC };
            } else {
                // Caso: fechas diferentes → rango completo del primer día a último día, en UTC
                const startUTC = new Date(Date.UTC(yI, mI - 1, dI, 0, 0, 0, 0));
                const endUTC = new Date(
                    Date.UTC(yF, mF - 1, dF, 23, 59, 59, 999)
                );
                filter.date = {
                    gte: startUTC,
                    lte: endUTC,
                };
            }
        }

        // 4) Ejecutar la consulta
        const cortes = await prisma.corte.findMany({
            where: filter,
            orderBy: { date: 'desc' },
        });

        return res.json(cortes);
    } catch (error) {
        console.error('POST /api/cortes/range →', error);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

export const generateCortePDF = async (req, res) => {
    try {
        const { id } = req.params;
        const corteId = parseInt(id, 10);
        if (isNaN(corteId)) {
            return res.status(400).json({ message: 'ID de corte inválido' });
        }

        // 1) Obtener el registro de corte junto con store y user
        const corte = await prisma.corte.findUnique({
            where: { id: corteId },
            include: {
                store: true,
                user: true,
            },
        });

        if (!corte) {
            return res.status(404).json({ message: 'No se encontró el corte' });
        }

        // 2) Extraer datos de la BD
        const {
            date,
            folioInicial,
            folioFinal,
            ventaTotal,
            costoTotal,
            efectivo,
            tarjeta,
            transferencia,
            ingresoInterno,
            apartados,
            comentarios,
            store,
            user,
        } = corte;

        // 3) Formatear fecha y hora del corte
        const fechaCorteFormato = new Date(date).toLocaleDateString('es-MX', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        const horaCorteFormato = new Date(corte.createdAt).toLocaleTimeString(
            'es-MX',
            {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            }
        );

        // 4) Definir dimensiones del PDF (por ejemplo, misma tirilla de venta: 58 mm de ancho, 300 mm de alto)
        const widthPt = mmToPt(58);
        const heightPt = mmToPt(300);

        // 5) Crear un documento PDF sin página automática
        const doc = new PDFDocument({
            size: [widthPt, heightPt],
            margins: { top: 0, left: 2, right: 2, bottom: 0 },
            autoFirstPage: false,
        });

        // 6) Cabeceras HTTP
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `inline; filename="corte-${corteId}.pdf"`
        );

        // 7) Pipe del PDF al response
        doc.pipe(res);

        // 8) Agregar la página
        doc.addPage();

        // 9) Empezar a dibujar en la página
        let y = 2;
        const usableWidth = widthPt - 4; // dejamos 2 pt de margen en cada lado

        // --- 9.1) Logo (opcional) ---
        doc.image(path.resolve(__dirname, '../img/logo_ticket2.jpg'), 2, y, {
            width: usableWidth,
        });
        y += 90;

        // --- 9.2) Título y datos fijos ---
        doc.font('Helvetica-Bold')
            .fontSize(14)
            .text('CORTE DE CAJA', 2, y, {
                width: usableWidth,
                align: 'center',
            });
        y += 18;

        // Sucursal
        doc.font('Helvetica')
            .fontSize(10)
            .text(`Sucursal: ${store.name}`, 2, y, {
                width: usableWidth,
                align: 'center',
            });
        y += 12;

        // Fecha y hora del corte
        doc.font('Helvetica')
            .fontSize(10)
            .text(`Fecha: ${fechaCorteFormato}`, 2, y, {
                width: usableWidth,
                align: 'center',
            });
        y += 12;
        doc.text(`Hora:  ${horaCorteFormato}`, 2, y, {
            width: usableWidth,
            align: 'center',
        });
        y += 14;

        // Usuario que generó el corte
        const nombreUsuario = `${user.name} ${user.lastName}`;
        doc.font('Helvetica')
            .fontSize(9)
            .text(`Usuario: ${nombreUsuario}`, 2, y, {
                width: usableWidth,
                align: 'center',
            });
        y += 14;

        // --- 9.3) Rango de folios ---
        doc.font('Helvetica-Bold')
            .fontSize(10)
            .text('Rango de folios:', 2, y, {
                width: usableWidth,
                align: 'left',
            });
        y += 12;
        doc.font('Helvetica')
            .fontSize(9)
            .text(`Del #${folioInicial} al #${folioFinal}`, 2, y, {
                width: usableWidth,
                align: 'left',
            });
        y += 16;

        // --- 9.4) Totales generales ---
        doc.font('Helvetica-Bold')
            .fontSize(10)
            .text('Totales de venta:', 2, y, {
                width: usableWidth,
                align: 'left',
            });
        y += 12;

        // Venta Total y Costo Total
        doc.font('Helvetica')
            .fontSize(9)
            .text(`Venta Total:     $${ventaTotal.toFixed(2)}`, 2, y);
        y += 12;
        doc.text(`Costo Total:     $${costoTotal.toFixed(2)}`, 2, y);
        y += 14;

        // Ingreso Interno (si existe) y Apartados
        if (ingresoInterno !== null) {
            doc.text(
                `Ingreso Cambios: $${Number(ingresoInterno).toFixed(2)}`,
                2,
                y
            );
            y += 12;
        }
        if (apartados !== null) {
            doc.text(`Apartados:       $${Number(apartados).toFixed(2)}`, 2, y);
            y += 12;
        }
        y += 4;

        // --- 9.5) Totales por método de pago ---
        doc.font('Helvetica-Bold')
            .fontSize(10)
            .text('Métodos de pago:', 2, y, {
                width: usableWidth,
                align: 'left',
            });
        y += 12;

        doc.font('Helvetica')
            .fontSize(9)
            .text(`Efectivo:       $${efectivo.toFixed(2)}`, 2, y);
        y += 12;
        doc.text(`Tarjeta:        $${tarjeta.toFixed(2)}`, 2, y);
        y += 12;
        doc.text(`Transferencia:  $${transferencia.toFixed(2)}`, 2, y);
        y += 14;

        // Total ingresado (efectivo+tarjeta+transferencia)
        const ingresoTotal =
            Number(efectivo) + Number(tarjeta) + Number(transferencia);
        doc.font('Helvetica-Bold')
            .fontSize(9)
            .text(`Ingreso Total:  $${ingresoTotal.toFixed(2)}`, 2, y);
        y += 16;

        // --- 9.6) Comentarios del corte (si hay) ---
        if (comentarios) {
            doc.font('Helvetica-Bold')
                .fontSize(9)
                .text('Comentarios:', 2, y, {
                    width: usableWidth,
                    align: 'left',
                });
            y += 12;
            doc.font('Helvetica')
                .fontSize(8)
                .text(comentarios, 2, y, { width: usableWidth, align: 'left' });
            y += 14;
        }

        // --- 9.7) Pie de página con agradecimiento o políticas ---
        doc.moveTo(2, y)
            .lineTo(widthPt - 2, y)
            .dash(5, { space: 2 })
            .stroke();

        y += 12;
        doc.fontSize(6).text('Este documento es un corte de caja.', 2, y, {
            width: usableWidth,
            align: 'center',
        });

        // 10) Finalizar el PDF
        doc.end();
    } catch (err) {
        console.error('Error generando PDF de corte:', err);
        if (!res.headersSent) {
            res.status(500).send('Error al generar PDF de corte');
        } else {
            res.end();
        }
    }
};
