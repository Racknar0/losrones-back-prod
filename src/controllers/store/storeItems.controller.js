import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const normalizeSlug = (value = '') => {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'si'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return fallback;
};

const parseCategoryIds = (rawValue) => {
  if (rawValue === undefined) {
    return { provided: false, value: [] };
  }

  if (rawValue === null || rawValue === '') {
    return { provided: true, value: [] };
  }

  let ids = rawValue;

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();

    try {
      ids = JSON.parse(trimmed);
    } catch {
      ids = trimmed.split(',').map((id) => id.trim());
    }
  }

  if (!Array.isArray(ids)) {
    return { provided: true, value: [] };
  }

  const normalized = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  return { provided: true, value: normalized };
};

const parsePositiveIntegerArray = (rawValue) => {
  if (rawValue === undefined) {
    return { provided: false, value: [] };
  }

  if (rawValue === null || rawValue === '') {
    return { provided: true, value: [] };
  }

  let values = rawValue;

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();

    try {
      values = JSON.parse(trimmed);
    } catch {
      values = trimmed.split(',').map((value) => value.trim());
    }
  }

  if (!Array.isArray(values)) {
    return { provided: true, value: [] };
  }

  return {
    provided: true,
    value: [...new Set(values.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))],
  };
};

const parseStringArray = (rawValue) => {
  if (rawValue === undefined) {
    return { provided: false, value: [] };
  }

  if (rawValue === null || rawValue === '') {
    return { provided: true, value: [] };
  }

  let values = rawValue;

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();

    try {
      values = JSON.parse(trimmed);
    } catch {
      values = trimmed.split(',').map((value) => value.trim());
    }
  }

  if (!Array.isArray(values)) {
    return { provided: true, value: [] };
  }

  return {
    provided: true,
    value: [...new Set(values.map((value) => String(value).trim()).filter(Boolean))],
  };
};

const isLocalUploadPath = (filePath) => {
  return typeof filePath === 'string' && /^uploads[\\/]/.test(filePath);
};

const deleteLocalUploadFile = (relativePath) => {
  if (!isLocalUploadPath(relativePath)) {
    return;
  }

  try {
    const absolutePath = path.join(process.cwd(), relativePath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (error) {
    console.error(`Error deleting file ${relativePath}:`, error);
  }
};

const getStoreItemWithRelations = (id) => {
  return prisma.storeitem.findUnique({
    where: { id },
    include: {
      product: {
        include: {
          category: true,
        },
      },
      storeCategories: {
        include: {
          category: true,
        },
      },
    },
  });
};

const normalizeStoreItemWithCategories = (item) => ({
  ...item,
  categories: item.storeCategories.map((relation) => relation.category),
});

const stripHtmlTags = (html = '') => {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const NEWS_TAG_COLOR_OPTIONS = ['#ffba30', '#27ae60', '#3498db', '#e74c3c', '#1abc9c'];
const DEFAULT_NEWS_TAG_COLOR = NEWS_TAG_COLOR_OPTIONS[0];

const normalizeNewsTagColor = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  const withHash = normalized.startsWith('#') ? normalized : `#${normalized}`;

  return NEWS_TAG_COLOR_OPTIONS.includes(withHash) ? withHash : fallback;
};

const toNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizePublicStoreItem = (item) => {
  const categories = item.storeCategories.map((relation) => relation.category);
  const webPrice = toNumberOrNull(item.webPrice);
  const compareAtPrice = toNumberOrNull(item.compareAtPrice);

  const safeWebPrice = webPrice !== null && webPrice > 0 ? webPrice : 0;
  const fallbackPrice =
    safeWebPrice > 0
      ? safeWebPrice
      : compareAtPrice !== null && compareAtPrice > 0
        ? compareAtPrice
        : 0;

  // Solo se considera descuento cuando el precio con descuento es valido y menor al precio base.
  const hasValidDiscount =
    compareAtPrice !== null &&
    compareAtPrice > 0 &&
    safeWebPrice > 0 &&
    compareAtPrice < safeWebPrice;

  const price = hasValidDiscount ? compareAtPrice : fallbackPrice;
  const originalPrice = hasValidDiscount ? safeWebPrice : price;
  const gallery = Array.isArray(item.gallery)
    ? item.gallery.map((entry) => String(entry)).filter(Boolean)
    : [];
  const primaryImage = item.image || gallery[0] || item.product?.image || null;

  return {
    id: item.id,
    productId: item.productId,
    slug: item.slug,
    name: item.alias || item.product?.name || '',
    description: item.description || '',
    price,
    originalPrice,
    image: primaryImage,
    gallery,
    rating: 5,
    categories,
    categoryIds: categories.map((category) => category.id),
  };
};

const ensureUniqueCategorySlug = async (name, currentCategoryId = null) => {
  const base = normalizeSlug(name) || 'categoria-tienda';
  let candidate = base;
  let index = 1;

  while (true) {
    const existing = await prisma.storecategory.findFirst({
      where: {
        slug: candidate,
        ...(currentCategoryId ? { id: { not: currentCategoryId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${base}-${index}`;
    index += 1;
  }
};

export const getSourceProductsForStoreItems = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();

    const products = await prisma.product.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { code: { contains: search } },
              { barcode: { contains: search } },
            ],
          }
        : undefined,
      include: {
        category: true,
        storeItem: {
          select: {
            id: true,
            alias: true,
            isPublished: true,
            webPrice: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching source products for store items:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener productos fuente' });
  }
};

export const createStoreItemsFromProducts = async (req, res) => {
  const { productIds } = req.body;

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ message: 'Debe enviar al menos un productId' });
  }

  const normalizedProductIds = [...new Set(productIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];

  if (normalizedProductIds.length === 0) {
    return res.status(400).json({ message: 'Los productIds enviados no son válidos' });
  }

  try {
    const existingStoreItems = await prisma.storeitem.findMany({
      where: {
        productId: {
          in: normalizedProductIds,
        },
      },
      select: {
        productId: true,
      },
    });

    const existingProductIds = new Set(existingStoreItems.map((item) => item.productId));
    const productIdsToCreate = normalizedProductIds.filter((id) => !existingProductIds.has(id));

    if (productIdsToCreate.length === 0) {
      return res.status(200).json({
        message: 'Todos los productos seleccionados ya existen como items de tienda',
        createdCount: 0,
      });
    }

    const sourceProducts = await prisma.product.findMany({
      where: {
        id: {
          in: productIdsToCreate,
        },
      },
      select: {
        id: true,
        name: true,
        salePrice: true,
        image: true,
      },
    });

    if (sourceProducts.length === 0) {
      return res.status(404).json({ message: 'No se encontraron productos para crear items de tienda' });
    }

    const toCreate = sourceProducts.map((product) => ({
      productId: product.id,
      alias: product.name,
      slug: `${normalizeSlug(product.name) || 'item-tienda'}-${product.id}`,
      webPrice: product.salePrice,
      compareAtPrice: null,
      image: product.image,
      isPublished: false,
      gallery: [],
    }));

    await prisma.storeitem.createMany({
      data: toCreate,
      skipDuplicates: true,
    });

    const createdItems = await prisma.storeitem.findMany({
      where: {
        productId: {
          in: sourceProducts.map((product) => product.id),
        },
      },
      include: {
        product: true,
      },
      orderBy: {
        id: 'desc',
      },
    });

    return res.status(201).json({
      message: 'Items de tienda creados correctamente',
      createdCount: createdItems.length,
      createdItems,
    });
  } catch (error) {
    console.error('Error creating store items from products:', error);
    return res.status(500).json({ message: 'Error del servidor al crear items de tienda' });
  }
};

export const getStoreItems = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();

    const storeItems = await prisma.storeitem.findMany({
      where: search
        ? {
            OR: [
              { alias: { contains: search } },
              { product: { name: { contains: search } } },
              { product: { code: { contains: search } } },
              { slug: { contains: search } },
            ],
          }
        : undefined,
      include: {
        product: {
          include: {
            category: true,
          },
        },
        storeCategories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const normalizedItems = storeItems.map(normalizeStoreItemWithCategories);

    return res.status(200).json(normalizedItems);
  } catch (error) {
    console.error('Error fetching store items:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener items de tienda' });
  }
};

export const updateStoreItem = async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'El id del item de tienda no es válido' });
  }

  try {
    const existingStoreItem = await prisma.storeitem.findUnique({
      where: { id },
      select: {
        id: true,
        image: true,
        gallery: true,
      },
    });

    if (!existingStoreItem) {
      return res.status(404).json({ message: 'Item de tienda no encontrado' });
    }

    const alias = req.body.alias?.trim();
    const description = req.body.description?.trim();
    const webPriceRaw = req.body.webPrice;
    const compareAtPriceRaw = req.body.compareAtPrice;
    const isPublished = parseBoolean(req.body.isPublished, undefined);
    const parsedCategoryIds = parseCategoryIds(req.body.categoryIds);
    const parsedRemainingGallery = parseStringArray(req.body.remainingGallery);
    const uploadedGallery = Array.isArray(req.files)
      ? req.files.map((file) => file?.path).filter(Boolean)
      : [];
    const existingGallery = Array.isArray(existingStoreItem.gallery)
      ? existingStoreItem.gallery.map((entry) => String(entry)).filter(Boolean)
      : [];

    if (!alias) {
      return res.status(400).json({ message: 'El nombre en tienda es obligatorio' });
    }

    if (webPriceRaw === undefined || webPriceRaw === '') {
      return res.status(400).json({ message: 'El precio es obligatorio' });
    }

    if (!parsedCategoryIds.provided || parsedCategoryIds.value.length === 0) {
      return res.status(400).json({ message: 'Debes seleccionar al menos una categoría de tienda' });
    }

    if (!description) {
      return res.status(400).json({ message: 'La descripción es obligatoria' });
    }

    const dataToUpdate = {};

    dataToUpdate.alias = alias;
    dataToUpdate.slug = `${normalizeSlug(alias) || 'item-tienda'}-${id}`;

    dataToUpdate.description = description;

    const webPrice = Number(webPriceRaw);
    if (!Number.isFinite(webPrice) || webPrice <= 0) {
      return res.status(400).json({ message: 'El precio no es válido' });
    }
    dataToUpdate.webPrice = webPrice;

    if (compareAtPriceRaw !== undefined) {
      if (compareAtPriceRaw === '' || compareAtPriceRaw === null) {
        dataToUpdate.compareAtPrice = null;
      } else {
        const compareAtPrice = Number(compareAtPriceRaw);
        if (!Number.isFinite(compareAtPrice) || compareAtPrice < 0) {
          return res.status(400).json({ message: 'El precio con descuento no es válido' });
        }
        if (compareAtPrice > webPrice) {
          return res.status(400).json({ message: 'El precio con descuento no puede ser mayor al precio' });
        }
        dataToUpdate.compareAtPrice = compareAtPrice;
      }
    }

    if (isPublished !== undefined) {
      dataToUpdate.isPublished = isPublished;
    }

    if (parsedRemainingGallery.provided || uploadedGallery.length > 0) {
      const baseGallery = parsedRemainingGallery.provided
        ? parsedRemainingGallery.value
        : existingGallery;

      const mergedGallery = [...new Set([...baseGallery, ...uploadedGallery])];

      if (mergedGallery.length === 0) {
        return res.status(400).json({ message: 'Debes anexar al menos una imagen' });
      }

      dataToUpdate.gallery = mergedGallery;
      dataToUpdate.image = mergedGallery[0] || null;

      const filesToDelete = existingGallery.filter((filePath) => !mergedGallery.includes(filePath));

      if (existingStoreItem.image && !mergedGallery.includes(existingStoreItem.image)) {
        filesToDelete.push(existingStoreItem.image);
      }

      [...new Set(filesToDelete)].forEach(deleteLocalUploadFile);
    } else if (existingGallery.length === 0) {
      return res.status(400).json({ message: 'Debes anexar al menos una imagen' });
    }

    await prisma.storeitem.update({
      where: { id },
      data: dataToUpdate,
    });

    const categories = await prisma.storecategory.findMany({
      where: {
        id: {
          in: parsedCategoryIds.value,
        },
      },
      select: { id: true },
    });

    if (categories.length !== parsedCategoryIds.value.length) {
      return res.status(400).json({ message: 'Una o más categorías de tienda no existen' });
    }

    await prisma.$transaction([
      prisma.storeitemcategory.deleteMany({
        where: { storeItemId: id },
      }),
      prisma.storeitemcategory.createMany({
        data: parsedCategoryIds.value.map((categoryId) => ({
          storeItemId: id,
          categoryId,
        })),
        skipDuplicates: true,
      }),
    ]);

    const updatedStoreItem = await getStoreItemWithRelations(id);

    return res.status(200).json({
      message: 'Item de tienda actualizado correctamente',
      storeItem: normalizeStoreItemWithCategories(updatedStoreItem),
    });
  } catch (error) {
    console.error('Error updating store item:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Ya existe un item de tienda con esos datos únicos' });
    }

    return res.status(500).json({ message: 'Error del servidor al actualizar item de tienda' });
  }
};

export const deleteStoreItem = async (req, res) => {
  return res.status(400).json({
    message: 'Para eliminar un item de tienda debes eliminar primero el producto maestro desde el módulo de productos',
  });
};

export const getStoreCategories = async (_req, res) => {
  try {
    const categories = await prisma.storecategory.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return res.status(200).json(categories);
  } catch (error) {
    console.error('Error fetching store categories:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener categorías de tienda' });
  }
};

export const getPublicStoreCategories = async (_req, res) => {
  try {
    const categories = await prisma.storecategory.findMany({
      where: {
        storeItems: {
          some: {
            storeItem: {
              isPublished: true,
            },
          },
        },
      },
      include: {
        storeItems: {
          where: {
            storeItem: {
              isPublished: true,
            },
          },
          select: {
            storeItemId: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    const normalized = categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      productsCount: category.storeItems.length,
    }));

    return res.status(200).json(normalized);
  } catch (error) {
    console.error('Error fetching public store categories:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener categorias publicas de tienda' });
  }
};

export const getPublicStoreItems = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const rawCategoryId = req.query.categoryId ?? req.query.category;
    const categoryId = Number(rawCategoryId);
    const categorySlug = String(req.query.categorySlug || '').trim();

    const where = {
      isPublished: true,
    };

    if (search) {
      where.OR = [
        { alias: { contains: search } },
        { description: { contains: search } },
        { product: { name: { contains: search } } },
        { product: { code: { contains: search } } },
      ];
    }

    if (Number.isInteger(categoryId) && categoryId > 0) {
      where.storeCategories = {
        some: {
          categoryId,
        },
      };
    } else if (categorySlug) {
      where.storeCategories = {
        some: {
          category: {
            slug: categorySlug,
          },
        },
      };
    }

    const storeItems = await prisma.storeitem.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            code: true,
            image: true,
          },
        },
        storeCategories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: [
        { updatedAt: 'desc' },
        { id: 'desc' },
      ],
    });

    const normalizedItems = storeItems.map(normalizePublicStoreItem);

    return res.status(200).json({
      items: normalizedItems,
      total: normalizedItems.length,
    });
  } catch (error) {
    console.error('Error fetching public store items:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener productos publicos de tienda' });
  }
};

export const getPublicFavoriteBlockCategories = async (_req, res) => {
  try {
    const favoriteCategories = await prisma.storefavoriteblockcategory.findMany({
      include: {
        storeCategory: true,
        favoriteItems: {
          where: {
            storeItem: {
              isPublished: true,
            },
          },
          select: {
            storeItemId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const normalized = favoriteCategories
      .map((favoriteCategory) => ({
        id: favoriteCategory.id,
        storeCategoryId: favoriteCategory.storeCategoryId,
        category: favoriteCategory.storeCategory,
        selectedItemsCount: favoriteCategory.favoriteItems.length,
      }))
      .filter((favoriteCategory) => favoriteCategory.selectedItemsCount > 0);

    return res.status(200).json(normalized);
  } catch (error) {
    console.error('Error fetching public favorite block categories:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener categorias publicas de favoritos' });
  }
};

export const getPublicFavoriteProducts = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const rawFavoriteCategoryId = req.query.favoriteCategoryId ?? req.query.categoryId;
    const hasFavoriteCategoryId = rawFavoriteCategoryId !== undefined && rawFavoriteCategoryId !== null && rawFavoriteCategoryId !== '';
    const favoriteCategoryId = Number(rawFavoriteCategoryId);

    if (hasFavoriteCategoryId && (!Number.isInteger(favoriteCategoryId) || favoriteCategoryId <= 0)) {
      return res.status(400).json({ message: 'El id de categoria de favoritos no es valido' });
    }

    const where = {
      isPublished: true,
      favoriteBlockItems: {
        some: hasFavoriteCategoryId
          ? {
              favoriteCategoryId,
            }
          : {},
      },
    };

    if (search) {
      where.OR = [
        { alias: { contains: search } },
        { description: { contains: search } },
        { product: { name: { contains: search } } },
        { product: { code: { contains: search } } },
      ];
    }

    const storeItems = await prisma.storeitem.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            code: true,
            image: true,
          },
        },
        storeCategories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        alias: 'asc',
      },
    });

    const normalizedItems = storeItems.map(normalizePublicStoreItem);

    return res.status(200).json({
      items: normalizedItems,
      total: normalizedItems.length,
    });
  } catch (error) {
    console.error('Error fetching public favorite products:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener productos publicos de favoritos' });
  }
};

export const createStoreCategory = async (req, res) => {
  const name = req.body.name?.trim();

  if (!name) {
    return res.status(400).json({ message: 'El nombre de la categoría es obligatorio' });
  }

  try {
    const slug = await ensureUniqueCategorySlug(name);

    const category = await prisma.storecategory.create({
      data: {
        name,
        slug,
      },
    });

    return res.status(201).json({ message: 'Categoría de tienda creada', category });
  } catch (error) {
    console.error('Error creating store category:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Ya existe una categoría con ese nombre o slug' });
    }

    return res.status(500).json({ message: 'Error del servidor al crear categoría de tienda' });
  }
};

export const updateStoreCategory = async (req, res) => {
  const id = Number(req.params.id);
  const name = req.body.name?.trim();

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'El id de la categoría no es válido' });
  }

  if (!name) {
    return res.status(400).json({ message: 'El nombre de la categoría es obligatorio' });
  }

  try {
    const existingCategory = await prisma.storecategory.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return res.status(404).json({ message: 'Categoría de tienda no encontrada' });
    }

    const slug = await ensureUniqueCategorySlug(name, id);

    const category = await prisma.storecategory.update({
      where: { id },
      data: {
        name,
        slug,
      },
    });

    return res.status(200).json({ message: 'Categoría de tienda actualizada', category });
  } catch (error) {
    console.error('Error updating store category:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Ya existe una categoría con ese nombre o slug' });
    }

    return res.status(500).json({ message: 'Error del servidor al actualizar categoría de tienda' });
  }
};

export const deleteStoreCategory = async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'El id de la categoría no es válido' });
  }

  try {
    const existingCategory = await prisma.storecategory.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingCategory) {
      return res.status(404).json({ message: 'Categoría de tienda no encontrada' });
    }

    const linkedItems = await prisma.storeitemcategory.findMany({
      where: {
        categoryId: id,
      },
      select: {
        storeItemId: true,
      },
    });

    const linkedItemIds = [...new Set(linkedItems.map((entry) => entry.storeItemId))];

    await prisma.storecategory.delete({
      where: { id },
    });

    if (linkedItemIds.length > 0) {
      const uncategorizedItems = await prisma.storeitem.findMany({
        where: {
          id: {
            in: linkedItemIds,
          },
          storeCategories: {
            none: {},
          },
        },
        select: {
          id: true,
        },
      });

      if (uncategorizedItems.length > 0) {
        await prisma.storeitem.updateMany({
          where: {
            id: {
              in: uncategorizedItems.map((item) => item.id),
            },
          },
          data: {
            isPublished: false,
          },
        });
      }
    }

    return res.status(200).json({ message: 'Categoría de tienda eliminada y items sin categoría pasados a borrador' });
  } catch (error) {
    console.error('Error deleting store category:', error);
    return res.status(500).json({ message: 'Error del servidor al eliminar categoría de tienda' });
  }
};

export const getFavoriteBlockCategories = async (_req, res) => {
  try {
    const favoriteCategories = await prisma.storefavoriteblockcategory.findMany({
      include: {
        storeCategory: true,
        _count: {
          select: {
            favoriteItems: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const normalized = favoriteCategories.map((favoriteCategory) => ({
      id: favoriteCategory.id,
      storeCategoryId: favoriteCategory.storeCategoryId,
      category: favoriteCategory.storeCategory,
      selectedItemsCount: favoriteCategory._count.favoriteItems,
      createdAt: favoriteCategory.createdAt,
      updatedAt: favoriteCategory.updatedAt,
    }));

    return res.status(200).json(normalized);
  } catch (error) {
    console.error('Error fetching favorite block categories:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener categorias de bloque favoritos' });
  }
};

export const createFavoriteBlockCategory = async (req, res) => {
  const storeCategoryId = Number(req.body.storeCategoryId);

  if (!Number.isInteger(storeCategoryId) || storeCategoryId <= 0) {
    return res.status(400).json({ message: 'La categoria de tienda seleccionada no es valida' });
  }

  try {
    const storeCategory = await prisma.storecategory.findUnique({
      where: { id: storeCategoryId },
      select: { id: true, name: true, slug: true },
    });

    if (!storeCategory) {
      return res.status(404).json({ message: 'La categoria de tienda no existe' });
    }

    const favoriteCategory = await prisma.storefavoriteblockcategory.create({
      data: {
        storeCategoryId,
      },
      include: {
        storeCategory: true,
        _count: {
          select: {
            favoriteItems: true,
          },
        },
      },
    });

    return res.status(201).json({
      message: 'Categoria agregada al bloque favoritos',
      favoriteCategory: {
        id: favoriteCategory.id,
        storeCategoryId: favoriteCategory.storeCategoryId,
        category: favoriteCategory.storeCategory,
        selectedItemsCount: favoriteCategory._count.favoriteItems,
        createdAt: favoriteCategory.createdAt,
        updatedAt: favoriteCategory.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error creating favorite block category:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Esta categoria ya esta configurada en bloque favoritos' });
    }

    return res.status(500).json({ message: 'Error del servidor al crear categoria de bloque favoritos' });
  }
};

export const deleteFavoriteBlockCategory = async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'El id de categoria de bloque favoritos no es valido' });
  }

  try {
    const existingCategory = await prisma.storefavoriteblockcategory.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingCategory) {
      return res.status(404).json({ message: 'Categoria de bloque favoritos no encontrada' });
    }

    await prisma.storefavoriteblockcategory.delete({
      where: { id },
    });

    return res.status(200).json({ message: 'Categoria eliminada de bloque favoritos' });
  } catch (error) {
    console.error('Error deleting favorite block category:', error);
    return res.status(500).json({ message: 'Error del servidor al eliminar categoria de bloque favoritos' });
  }
};

export const getProductsForFavoriteBlockCategory = async (req, res) => {
  const favoriteCategoryId = Number(req.params.id);
  const search = (req.query.search || '').trim();

  if (!Number.isInteger(favoriteCategoryId) || favoriteCategoryId <= 0) {
    return res.status(400).json({ message: 'El id de categoria de bloque favoritos no es valido' });
  }

  try {
    const favoriteCategory = await prisma.storefavoriteblockcategory.findUnique({
      where: { id: favoriteCategoryId },
      include: {
        storeCategory: true,
      },
    });

    if (!favoriteCategory) {
      return res.status(404).json({ message: 'Categoria de bloque favoritos no encontrada' });
    }

    const storeItems = await prisma.storeitem.findMany({
      where: {
        isPublished: true,
        storeCategories: {
          some: {
            categoryId: favoriteCategory.storeCategoryId,
          },
        },
        ...(search
          ? {
              OR: [
                { alias: { contains: search } },
                { product: { name: { contains: search } } },
                { product: { code: { contains: search } } },
              ],
            }
          : {}),
      },
      include: {
        product: {
          include: {
            category: true,
          },
        },
        storeCategories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        alias: 'asc',
      },
    });

    const selectedItems = await prisma.storefavoriteblockitem.findMany({
      where: {
        favoriteCategoryId,
      },
      select: {
        storeItemId: true,
      },
    });

    const selectedSet = new Set(selectedItems.map((item) => item.storeItemId));

    const normalizedProducts = storeItems.map((item) => ({
      ...normalizeStoreItemWithCategories(item),
      isSelected: selectedSet.has(item.id),
    }));

    return res.status(200).json({
      favoriteCategory: {
        id: favoriteCategory.id,
        storeCategoryId: favoriteCategory.storeCategoryId,
        category: favoriteCategory.storeCategory,
      },
      products: normalizedProducts,
    });
  } catch (error) {
    console.error('Error fetching products for favorite block category:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener productos de bloque favoritos' });
  }
};

export const updateFavoriteBlockCategoryProducts = async (req, res) => {
  const favoriteCategoryId = Number(req.params.id);
  const parsedStoreItemIds = parsePositiveIntegerArray(req.body.storeItemIds);

  if (!Number.isInteger(favoriteCategoryId) || favoriteCategoryId <= 0) {
    return res.status(400).json({ message: 'El id de categoria de bloque favoritos no es valido' });
  }

  if (!parsedStoreItemIds.provided) {
    return res.status(400).json({ message: 'Debes enviar storeItemIds como arreglo' });
  }

  try {
    const favoriteCategory = await prisma.storefavoriteblockcategory.findUnique({
      where: { id: favoriteCategoryId },
      select: {
        id: true,
        storeCategoryId: true,
      },
    });

    if (!favoriteCategory) {
      return res.status(404).json({ message: 'Categoria de bloque favoritos no encontrada' });
    }

    if (parsedStoreItemIds.value.length > 0) {
      const validItems = await prisma.storeitem.findMany({
        where: {
          id: {
            in: parsedStoreItemIds.value,
          },
          isPublished: true,
          storeCategories: {
            some: {
              categoryId: favoriteCategory.storeCategoryId,
            },
          },
        },
        select: { id: true },
      });

      if (validItems.length !== parsedStoreItemIds.value.length) {
        return res.status(400).json({
          message: 'Uno o mas items no son validos para esta categoria o no estan publicados',
        });
      }
    }

    await prisma.$transaction([
      prisma.storefavoriteblockitem.deleteMany({
        where: {
          favoriteCategoryId,
        },
      }),
      ...(parsedStoreItemIds.value.length > 0
        ? [
            prisma.storefavoriteblockitem.createMany({
              data: parsedStoreItemIds.value.map((storeItemId) => ({
                favoriteCategoryId,
                storeItemId,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    return res.status(200).json({
      message: 'Productos favoritos actualizados correctamente',
      selectedCount: parsedStoreItemIds.value.length,
    });
  } catch (error) {
    console.error('Error updating favorite block products:', error);
    return res.status(500).json({ message: 'Error del servidor al actualizar productos favoritos' });
  }
};

export const getHighlightBlock = async (_req, res) => {
  try {
    const highlightBlock = await prisma.storehighlightblock.findUnique({
      where: { key: 'home' },
    });

    if (!highlightBlock) {
      return res.status(200).json({
        key: 'home',
        title: '',
        description: '',
        discountLabel: '',
        image: null,
        isActive: true,
      });
    }

    return res.status(200).json(highlightBlock);
  } catch (error) {
    console.error('Error fetching highlight block:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener bloque destacado' });
  }
};

export const getPublicHighlightBlock = async (_req, res) => {
  try {
    const highlightBlock = await prisma.storehighlightblock.findUnique({
      where: { key: 'home' },
    });

    if (!highlightBlock) {
      return res.status(200).json({
        key: 'home',
        title: '',
        description: '',
        discountLabel: '',
        image: null,
        isActive: true,
      });
    }

    return res.status(200).json(highlightBlock);
  } catch (error) {
    console.error('Error fetching public highlight block:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener bloque destacado publico' });
  }
};

export const updateHighlightBlock = async (req, res) => {
  try {
    const title = req.body.title?.trim() || '';
    const description = req.body.description?.trim() || '';
    const discountLabel = req.body.discountLabel?.trim() || '';
    const isActive = parseBoolean(req.body.isActive, true);
    const keepCurrentImage = parseBoolean(req.body.keepCurrentImage, true);
    const uploadedImage = req.file?.path || null;

    if (!title) {
      return res.status(400).json({ message: 'El titulo del bloque destacado es obligatorio' });
    }

    if (!description) {
      return res.status(400).json({ message: 'La descripcion del bloque destacado es obligatoria' });
    }

    const existingBlock = await prisma.storehighlightblock.findUnique({
      where: { key: 'home' },
      select: {
        id: true,
        image: true,
      },
    });

    const resolvedImage = uploadedImage
      ? uploadedImage
      : keepCurrentImage
        ? existingBlock?.image || null
        : null;

    if (!resolvedImage) {
      return res.status(400).json({ message: 'Debes anexar una imagen para el bloque destacado' });
    }

    if (uploadedImage && existingBlock?.image && existingBlock.image !== uploadedImage) {
      deleteLocalUploadFile(existingBlock.image);
    }

    if (!keepCurrentImage && !uploadedImage && existingBlock?.image) {
      deleteLocalUploadFile(existingBlock.image);
    }

    const highlightBlock = await prisma.storehighlightblock.upsert({
      where: { key: 'home' },
      create: {
        key: 'home',
        title,
        description,
        discountLabel: discountLabel || null,
        image: resolvedImage,
        isActive,
      },
      update: {
        title,
        description,
        discountLabel: discountLabel || null,
        image: resolvedImage,
        isActive,
      },
    });

    return res.status(200).json({
      message: 'Bloque destacado actualizado correctamente',
      highlightBlock,
    });
  } catch (error) {
    console.error('Error updating highlight block:', error);
    return res.status(500).json({ message: 'Error del servidor al actualizar bloque destacado' });
  }
};

export const getStoreNews = async (_req, res) => {
  try {
    const news = await prisma.storenews.findMany({
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const normalizedNews = news.map((entry) => {
      const normalizedTagColor = entry.tag
        ? normalizeNewsTagColor(entry.tagColor, DEFAULT_NEWS_TAG_COLOR)
        : null;

      return {
        ...entry,
        tagColor: normalizedTagColor,
        excerpt: stripHtmlTags(entry.descriptionHtml).slice(0, 160),
      };
    });

    return res.status(200).json(normalizedNews);
  } catch (error) {
    console.error('Error fetching store news:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener noticias' });
  }
};

export const getPublicStoreNews = async (_req, res) => {
  try {
    const news = await prisma.storenews.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const normalizedNews = news.map((entry) => {
      const normalizedTagColor = entry.tag
        ? normalizeNewsTagColor(entry.tagColor, DEFAULT_NEWS_TAG_COLOR)
        : null;

      return {
        ...entry,
        tagColor: normalizedTagColor,
        excerpt: stripHtmlTags(entry.descriptionHtml).slice(0, 160),
      };
    });

    return res.status(200).json(normalizedNews);
  } catch (error) {
    console.error('Error fetching public store news:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener noticias publicas' });
  }
};

export const createStoreNews = async (req, res) => {
  try {
    const title = req.body.title?.trim() || '';
    const tag = req.body.tag?.trim() || '';
    const tagColor = normalizeNewsTagColor(req.body.tagColor, tag ? DEFAULT_NEWS_TAG_COLOR : null);
    const descriptionHtml = req.body.descriptionHtml || '';
    const descriptionText = stripHtmlTags(descriptionHtml);
    const isActive = parseBoolean(req.body.isActive, true);
    const image = req.file?.path || null;

    if (!title) {
      return res.status(400).json({ message: 'El titulo de la noticia es obligatorio' });
    }

    if (!descriptionText) {
      return res.status(400).json({ message: 'La descripcion de la noticia es obligatoria' });
    }

    if (!image) {
      return res.status(400).json({ message: 'La imagen de la noticia es obligatoria' });
    }

    const news = await prisma.storenews.create({
      data: {
        title,
        tag: tag || null,
        tagColor,
        descriptionHtml,
        image,
        isActive,
      },
    });

    return res.status(201).json({
      message: 'Noticia creada correctamente',
      news,
    });
  } catch (error) {
    console.error('Error creating store news:', error);
    return res.status(500).json({ message: 'Error del servidor al crear noticia' });
  }
};

export const updateStoreNews = async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'El id de la noticia no es valido' });
  }

  try {
    const existingNews = await prisma.storenews.findUnique({
      where: { id },
      select: {
        id: true,
        image: true,
      },
    });

    if (!existingNews) {
      return res.status(404).json({ message: 'Noticia no encontrada' });
    }

    const title = req.body.title?.trim() || '';
    const tag = req.body.tag?.trim() || '';
    const tagColor = normalizeNewsTagColor(req.body.tagColor, tag ? DEFAULT_NEWS_TAG_COLOR : null);
    const descriptionHtml = req.body.descriptionHtml || '';
    const descriptionText = stripHtmlTags(descriptionHtml);
    const isActive = parseBoolean(req.body.isActive, true);
    const keepCurrentImage = parseBoolean(req.body.keepCurrentImage, true);
    const uploadedImage = req.file?.path || null;

    if (!title) {
      return res.status(400).json({ message: 'El titulo de la noticia es obligatorio' });
    }

    if (!descriptionText) {
      return res.status(400).json({ message: 'La descripcion de la noticia es obligatoria' });
    }

    const resolvedImage = uploadedImage
      ? uploadedImage
      : keepCurrentImage
        ? existingNews.image
        : null;

    if (!resolvedImage) {
      return res.status(400).json({ message: 'Debes anexar una imagen para la noticia' });
    }

    if (uploadedImage && existingNews.image && existingNews.image !== uploadedImage) {
      deleteLocalUploadFile(existingNews.image);
    }

    if (!keepCurrentImage && !uploadedImage && existingNews.image) {
      deleteLocalUploadFile(existingNews.image);
    }

    const news = await prisma.storenews.update({
      where: { id },
      data: {
        title,
        tag: tag || null,
        tagColor,
        descriptionHtml,
        image: resolvedImage,
        isActive,
      },
    });

    return res.status(200).json({
      message: 'Noticia actualizada correctamente',
      news,
    });
  } catch (error) {
    console.error('Error updating store news:', error);
    return res.status(500).json({ message: 'Error del servidor al actualizar noticia' });
  }
};

export const deleteStoreNews = async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'El id de la noticia no es valido' });
  }

  try {
    const existingNews = await prisma.storenews.findUnique({
      where: { id },
      select: {
        id: true,
        image: true,
      },
    });

    if (!existingNews) {
      return res.status(404).json({ message: 'Noticia no encontrada' });
    }

    await prisma.storenews.delete({
      where: { id },
    });

    if (existingNews.image) {
      deleteLocalUploadFile(existingNews.image);
    }

    return res.status(200).json({ message: 'Noticia eliminada correctamente' });
  } catch (error) {
    console.error('Error deleting store news:', error);
    return res.status(500).json({ message: 'Error del servidor al eliminar noticia' });
  }
};
