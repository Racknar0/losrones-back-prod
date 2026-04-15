// src/controllers/sale/sale.controller.js

import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const prisma = new PrismaClient();

// Para recrear __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Helper: convierte milímetros a puntos de PDFKit
const mmToPt = mm => mm * 2.83465; // 1 mm ≈ 2.83465 pt

export const createSale = async (req, res) => {
  const {
    storeId,
    userId,
    paymentMethod,
    total,           
    totalSinCupon,   
    cupon,           
    received,        
    change,          
    items,
    returnedItems = [],
    originalSaleId = null, // ID de la venta original si es un cambio
    type = 'venta'      
  } = req.body;

  console.log('Datos recibidos para crear venta:', {
    storeId,
    userId,
    paymentMethod,
    total,
    totalSinCupon,
    cupon,
    received,
    change,
    items,
    returnedItems,
    originalSaleId,
    type
  });

  // 1) Validación para cambios parciales
  if (type === 'cambio') {
    if (!originalSaleId) {
      return res.status(400).json({
        message: 'Para un cambio debes enviar originalSaleId'
      });
    }
    if (!returnedItems.length) {
      return res.status(400).json({
        message: 'Para un cambio debes indicar al menos un ítem a devolver'
      });
    }
  }

  try {
    const sale = await prisma.$transaction(async (tx) => {
      // 2) Secuenciador de tickets por tienda
      const seq = await tx.storesequence.findUnique({
        where: { storeId }
      });

      let ticketNumber;
      if (seq) {
        ticketNumber = seq.nextTicket;
        await tx.storesequence.update({
          where: { storeId },
          data: { nextTicket: seq.nextTicket + 1 },
        });
      } else {
        // Si no existía registro (nunca vendió), arrancamos en 1
        ticketNumber = 1;
        await tx.storesequence.create({
          data: { storeId, nextTicket: 2 },
        });
      }

      // 3) Crear la cabecera de la nueva venta / cambio
      const newSale = await tx.sale.create({
        data: {
          storeId,
          userId,
          paymentMethod,
          totalAmount: total,
          totalWithoutCoupon: totalSinCupon,
          couponCode: cupon,
          receivedAmount: received,
          changeAmount: change,
          ticketNumber,
          type,             // 'venta' o 'cambio'
          originalSaleId,   // ID de la venta original
        },
      });

      // 4) Si es cambio, devolver al stock solo los ítems seleccionados
      if (type === 'cambio') {
        await Promise.all(
          returnedItems.map(({ stockUnitId }) =>
            tx.stockunit.update({
              where: { id: stockUnitId },
              data: { sold: false }
            })
          )
        );
      }

      // 5) Insertar los nuevos ítems en saleitem
      await Promise.all(
        items.map(i =>
          tx.saleitem.create({
            data: {
              saleId: newSale.id,
              stockUnitId: i.stockUnitId,
              productId: i.productId,
              unitPrice: parseFloat(i.price),
              itemCouponCode: i.itemCoupon || null,
            },
          })
        )
      );

      // 6) Marcar como vendidos los ítems nuevos
      await Promise.all(
        items.map(i =>
          tx.stockunit.update({
            where: { id: i.stockUnitId },
            data: { sold: true },
          })
        )
      );

      return newSale;
    });

    res.status(201).json({ message: 'Venta registrada', sale });
  } catch (err) {
    console.error('Error al crear venta:', err);
    res.status(500).json({ message: 'Error al crear la venta', error: err.message });
  }
};


export const listSales = async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        store: true,            // datos de la sucursal
        user: true,             // datos del usuario (si aplica)
        saleItems: {
          include: { product: true }  // cada item con su producto
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(sales);
  } catch (err) {
    console.error('Error al listar ventas:', err);
    res.status(500).json({ message: 'Error al listar ventas', error: err.message });
  }
};


/** 
  * DELETE /sales/:id
  * Elimina una venta por ID cambiando su estado isDeleted a true.
  * Devuelve la venta eliminada.
*/  
  export const deleteSale = async (req, res) => {

    const { id } = req.params;  

    if (!id) {
      return res.status(400).json({ message: 'Debe enviar el ID de la venta a eliminar' });
    }

    const deletedSale = await prisma.sale.update({
      where: { id: parseInt(id) },
      data: { isDeleted: true },
    });

    res.status(200).json(deletedSale);
  }



/**
 * POST /sales/filter
 * Body: { startDate: string, endDate: string }
 * Devuelve todas las ventas cuyo createdAt esté entre ambas fechas (inclusive).
 */
export const filterSalesByDate = async (req, res) => {
  try {
    let { startDate, endDate, storeId } = req.body;
    if (!startDate || !endDate || !storeId) {
      return res
        .status(400)
        .json({ message: 'Debe enviar startDate, endDate y storeId en el body' });
    }

    // Parseamos fechas y storeId
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const storeIdInt = parseInt(storeId, 10);

    const sales = await prisma.sale.findMany({
      where: {
        storeId: storeIdInt,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        store: true,
        user: true,
        saleItems: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('Ventas encontradas:', sales.length);

    // Para cada venta, procesar saleItems para agregar sellwhitcoupon
    for (const sale of sales) {
      for (const item of sale.saleItems) {
        if (item.itemCouponCode) {
          // Buscar el cupón en la base de datos
          const coupon = await prisma.coupon.findUnique({
            where: { code: item.itemCouponCode },
          });
          if (!coupon) {
            item.sellwhitcoupon = 'cupon borrado';
            item.couponDiscountValue = 'cupon borrado';
          } else {
            // El descuento es valor fijo
            const discount = parseFloat(coupon.discount);
            const price = parseFloat(item.unitPrice);
            item.sellwhitcoupon = (price - discount).toFixed(2);
            item.couponDiscountValue = discount;
          }
        } else {
          item.sellwhitcoupon = item.unitPrice;
          item.couponDiscountValue = 0;
        }
      }
    }

    console.log('Ventas filtradas por fecha y tienda:', sales.length);

    res.status(200).json(sales);
  } catch (err) {
    console.error('Error filtrando ventas por fecha y tienda:', err);
    res
      .status(500)
      .json({ message: 'Error al filtrar ventas', error: err.message });
  }
};


export const generateSalePDF = async (req, res) => {
  try {
    // 0) Obtener ID de venta desde la URL
    const { id } = req.params;

    // 0.1) Obtener la venta desde la base de datos
    const sale = await prisma.sale.findUnique({
      where: { id: parseInt(id) },
      include: {
        store: true,
        user: true,
        saleItems: {
          include: { product: true }
        }
      },
    });

    const storeName          = sale.store.name;
    const storeAddress       = sale.store.address;
    const storePhone         = sale.store.phone;
    const storeEmail         = sale.store.email;
    const storeId            = sale.store.id;
    const paymentMethod      = sale.paymentMethod;
    const ticketNumber       = sale.ticketNumber;
    const totalAmount        = parseFloat(sale.totalAmount);
    const totalWithoutCoupon = parseFloat(sale.totalWithoutCoupon);

    // 1) Tamaño exacto de la tirilla: 58 mm x 450 mm
    const widthPt  = mmToPt(58);
    const heightPt = mmToPt(450);

    // 2) Crear documento sin página inicial automática
    const doc = new PDFDocument({
      size:    [widthPt, heightPt],
      margins: { top: 0, left: 2, right: 2, bottom: 0 },
      autoFirstPage: false,
    });

    // 3) Encabezados HTTP
    res.setHeader('Content-Type',        'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="ticket.pdf"');

    // 4) Pipe al response
    doc.pipe(res);

    // 5) Agregar única página
    doc.addPage();

    // 6) Dibujar la tirilla con datos quemados
    let y = 2;
    const cw = widthPt - 4; // ancho usable

    // Logo
    doc.image(
      path.resolve(__dirname, '../img/logo_ticket2.jpg'),
      2, y,
      { width: cw }
    );
    y += 80;

    // Encabezado
    doc.font('Helvetica-Bold').fontSize(14)
       .text('Los Rones', 2, y, { width: cw, align: 'center' });
    y += 14;

    // Ajuste vertical según sucursal
    let dataYStoreId = [1,3,4].includes(storeId) ? 25 : 37;

    doc.font('Helvetica-Bold').fontSize(10)
       .text('Oscar Alejandro Gómez Morgado', 2, y + 5, { width: cw, align: 'center' });
    y += 17;

    doc.font('Helvetica-Bold').fontSize(10)
       .text(`Ticket: #${ticketNumber}`, 2, y, { width: cw, align: 'center' });
    y += 7;

    doc.font('Helvetica').fontSize(10)
       .text(`Suc. ${storeName}`, 2, y + 5, { width: cw, align: 'center' });
    y += 17;

    doc.font('Helvetica').fontSize(10)
       .text(`Dir. ${storeAddress}`, 2, y, { width: cw, align: 'center' });
    y += dataYStoreId;

    doc.font('Helvetica').fontSize(10)
       .text(`Tel. ${storePhone}`, 2, y, { width: cw, align: 'center' });
    y += 12;

    doc.font('Helvetica').fontSize(10)
       .text(`email: ${storeEmail}`, 2, y, { width: cw, align: 'center' });
    y += 12;

    const horaFactura = new Date(sale.createdAt)
      .toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const fechaFactura = new Date(sale.createdAt)
      .toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });

    doc.font('Helvetica').fontSize(10)
       .text(`Hora: ${horaFactura}`, 2, y, { width: cw, align: 'center' });
    y += 12;
    doc.text(`Fecha: ${fechaFactura}`, 2, y, { width: cw, align: 'center' });
    y += 12;

    doc.font('Helvetica').fontSize(10)
       .text('RFC: GOMO880312LA4', 2, y, { width: cw, align: 'center' });
    y += 33;

    doc.font('Helvetica-Bold').fontSize(10)
       .text(`Método de Pago: ${paymentMethod}`, 2, y, { width: cw, align: 'center' });
    y += 12;

    // Separador dashed
    doc.moveTo(2, y).lineTo(widthPt - 2, y).dash(5, { space: 2 }).stroke();
    y += 3;
    doc.moveTo(2, y).lineTo(widthPt - 2, y).dash(5, { space: 2 }).stroke();
    y += 8;

    // Tabla encabezados
    doc.font('Helvetica-Bold').fontSize(9)
       .text('PRODUCTOS:', 2, y, { width: cw * 0.7, align: 'left' });
    const precioX = 2 + cw * 0.7;
    doc.text('PRECIO', precioX, y, { width: cw * 0.3, align: 'right' });
    y += 12;

    // Listar productos nuevos
    sale.saleItems.forEach(item => {
      doc.font('Helvetica').fontSize(8)
         .text(item.product.name, 2, y, { width: cw * 0.7, align: 'left' })
         .text(`$${parseFloat(item.unitPrice).toFixed(2)}`, precioX, y, { width: cw * 0.3, align: 'right' });
      y += 14;
    });

    // Totales: diferenciamos venta vs cambio
    if (sale.type === 'cambio') {
      // suma de los precios nuevos
      const replacementSum = sale.saleItems.reduce(
        (sum, i) => sum + parseFloat(i.unitPrice),
        0
      );
      // lo devuelto = nuevos - totalAmount
      const returnedSum = replacementSum - totalAmount;

      y += 5;
      doc.moveTo(2, y).lineTo(widthPt - 2, y).dash(5, { space: 2 }).stroke();
      y += 10;

      doc.font('Helvetica-Bold').fontSize(9)
         .text(`DEVOLUCIÓN:   $${returnedSum.toFixed(2)}`, 2, y);
      y += 14;
      doc.text(`TOTAL A PAGAR: $${totalAmount.toFixed(2)}`, 2, y);
      y += 16;
    } else {
      // caso normal de venta con "DESCUENTO" si aplica
      const totalDescuento = totalWithoutCoupon - totalAmount;
      y += 5;
      doc.moveTo(2, y).lineTo(widthPt - 2, y).dash(5, { space: 2 }).stroke();
      y += 10;

      doc.font('Helvetica-Bold').fontSize(9)
         .text(`DESCUENTO:   $${totalDescuento.toFixed(2)}`, 2, y);
      y += 14;
      doc.text(`TOTAL:       $${totalAmount.toFixed(2)}`, 2, y);
      y += 16;
    }

    // Pie de página
    doc.font('Helvetica').fontSize(8)
       .text('¡GRACIAS POR SU COMPRA!', 2, y, { width: cw, align: 'center' });
    y += 14;
    doc.fontSize(7).text('Políticas', 2, y); y += 10;
    doc.text('+ No se hacen devoluciones.', 2, y); y += 10;
    doc.text('+ Sistema de apartado de 15 a 30 días.', 2, y); y += 10;
    doc.text('+ Cambio físico por otra talla 3 días después', 2, y); y += 10;
    doc.text('  de su compra, presentando su ticket.', 2, y); y += 10;
    doc.text('+ El cambio se realizará en la misma sucursal de compra.', 2, y); y += 25;
    doc.font('Helvetica-Bold').fontSize(6)
       .text('Facturación al Whatsapp 22.94.47.37.21', 2, y, { width: cw, align: 'center' });

    // 7) Finaliza la tirilla
    doc.end();
  } catch (err) {
    console.error('Error generando PDF:', err);
    if (!res.headersSent) {
      res.status(500).send('Error al generar ticket');
    } else {
      res.end();
    }
  }
};
