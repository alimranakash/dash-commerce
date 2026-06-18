import { prisma, type Prisma } from "@dash/db";
import { clearCart, getCart } from "../cart/cart.service";
import { checkoutSchema, type CheckoutInput } from "./checkout.schema";

type CheckoutStore = {
  currency: string;
  id: string;
  slug: string;
};

export async function createCheckoutOrder(store: CheckoutStore, input: CheckoutInput) {
  const data = checkoutSchema.parse(input);
  const cart = await getCart(store.id);

  if (cart.items.length === 0) {
    throw new Error("Your cart is empty.");
  }

  const order = await prisma.$transaction(async (tx) => {
    const productIds = cart.items.map((item) => item.productId);
    const products = await tx.product.findMany({
      where: {
        id: {
          in: productIds
        },
        storeId: store.id,
        status: "ACTIVE",
        visibility: "PUBLIC"
      },
      select: {
        id: true,
        sku: true,
        stockQuantity: true
      }
    });
    const productsById = new Map(products.map((product) => [product.id, product]));

    for (const item of cart.items) {
      const product = productsById.get(item.productId);

      if (!product) {
        throw new Error(`${item.title} is no longer available.`);
      }

      if (item.quantity > product.stockQuantity) {
        throw new Error(`${item.title} does not have enough stock.`);
      }
    }

    const customer = await tx.customer.upsert({
      where: {
        storeId_phone: {
          storeId: store.id,
          phone: data.phone
        }
      },
      update: {
        name: data.name,
        ...(data.email ? { email: data.email } : {})
      },
      create: {
        storeId: store.id,
        name: data.name,
        phone: data.phone,
        ...(data.email ? { email: data.email } : {})
      }
    });

    const address = await tx.address.create({
      data: {
        storeId: store.id,
        customerId: customer.id,
        name: data.name,
        phone: data.phone,
        email: data.email ?? null,
        country: data.country,
        district: data.district,
        city: data.city ?? null,
        area: data.area ?? null,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 ?? null,
        postalCode: data.postalCode ?? null
      }
    });

    for (const item of cart.items) {
      const updated = await tx.product.updateMany({
        where: {
          id: item.productId,
          storeId: store.id,
          status: "ACTIVE",
          visibility: "PUBLIC",
          stockQuantity: {
            gte: item.quantity
          }
        },
        data: {
          stockQuantity: {
            decrement: item.quantity
          }
        }
      });

      if (updated.count !== 1) {
        throw new Error(`${item.title} does not have enough stock.`);
      }
    }

    const orderNumber = await generateOrderNumber(tx, store.id);
    const subtotalAmount = cart.totals.subtotal;

    return tx.order.create({
      data: {
        storeId: store.id,
        customerId: customer.id,
        orderNumber,
        status: "PENDING",
        paymentStatus: "PENDING",
        fulfillmentStatus: "UNFULFILLED",
        currency: store.currency,
        subtotalAmount,
        shippingAmount: "0.00",
        discountAmount: "0.00",
        taxAmount: "0.00",
        totalAmount: subtotalAmount,
        customerName: data.name,
        customerEmail: data.email ?? null,
        customerPhone: data.phone,
        shippingAddressId: address.id,
        billingAddressId: address.id,
        notes: data.notes ?? null,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            title: item.title,
            sku: productsById.get(item.productId)?.sku ?? null,
            price: item.price,
            quantity: item.quantity,
            total: item.lineTotal,
            imageUrl: item.image
          }))
        }
      }
    });
  });

  await clearCart(store.id);

  return order;
}

async function generateOrderNumber(tx: Prisma.TransactionClient, storeId: string) {
  const latestOrder = await tx.order.findFirst({
    where: {
      storeId
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      orderNumber: true
    }
  });
  const latestNumber = latestOrder ? Number(latestOrder.orderNumber.replace("DASH-", "")) : 1000;
  const nextNumber = Number.isFinite(latestNumber) ? latestNumber + 1 : 1001;

  return `DASH-${nextNumber}`;
}
