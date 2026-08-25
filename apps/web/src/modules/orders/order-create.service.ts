import { prisma } from "@dash/db";
import { assertStoreUnlocked } from "../billing/free-trial";
import { canCreateOrder } from "../billing/subscription-limits";
import { assessOrderSafely } from "../fake-orders/fake-order.assessment";
import { getPaymentMethods } from "../payments/payment.service";
import { decrementProductVariantStock } from "../products/product-variants.service";
import { getEnabledShippingRates } from "../shipping/shipping.service";
import {
  createManualOrderSchema,
  type CreateManualOrderInput,
  type ManualOrderItemInput
} from "./order-create.schema";
import { generateOrderNumber } from "./order-number";

type ManualOrderStore = {
  currency: string;
  id: string;
};

type OrderLineWrite = {
  imageUrl: string | null;
  price: string;
  productId: string;
  quantity: number;
  sku: string | null;
  title: string;
  total: string;
  /** Null for a product sold without options; see OrderItem.variantId. */
  variantId: string | null;
};

/**
 * The seller writing an order down themselves.
 *
 * Most orders in this market never touch the storefront checkout — they arrive
 * over the phone, on Messenger, or across the counter — and until now the only
 * way to get one into the system was to place it as the customer. This is the
 * same commit as `createCheckoutOrder`: one transaction that reserves stock,
 * upserts the customer, snapshots the address, and writes the order with its
 * lines, so a seller-entered order is indistinguishable downstream and the
 * courier, SMS, and risk layers all work on it unchanged.
 *
 * Three things it deliberately does differently from checkout:
 *
 * - It sells DRAFT and HIDDEN products. Checkout filters to ACTIVE/PUBLIC
 *   because the shopper reached the product through the storefront; the seller
 *   did not, and refusing to let them sell their own unlisted stock over the
 *   phone would be an invented restriction.
 * - The seller sets the money. Unit price, delivery charge, and discount are all
 *   overridable, because a negotiated price is the normal case here.
 * - It can record the order as already paid, since on this path the cash is
 *   usually in hand before the order exists.
 */
export async function createManualOrder(store: ManualOrderStore, input: CreateManualOrderInput) {
  const data = createManualOrderSchema.parse(input);

  // Same order as checkout: a store whose free year ran out stops selling on
  // every path, and the plan's order cap is counted before any stock moves.
  await assertStoreUnlocked(store.id);

  if (!(await canCreateOrder(store.id))) {
    throw new Error(
      "This store has reached its monthly order limit and cannot accept new orders right now."
    );
  }

  const paymentMethods = await getPaymentMethods(store.id);
  // Any configured method, not only the ones switched on for the storefront: a
  // seller may take bKash on the phone while public checkout offers only COD.
  const paymentMethod = paymentMethods.find((method) => method.type === data.paymentMethod);

  if (!paymentMethod) {
    throw new Error("Selected payment method is not available.");
  }

  const shippingRate = data.shippingRateId
    ? (await getEnabledShippingRates(store.id)).find((rate) => rate.id === data.shippingRateId)
    : undefined;

  if (data.shippingRateId && !shippingRate) {
    throw new Error("Choose an available shipping method.");
  }

  const shippingAmount =
    data.shippingAmount ?? (shippingRate ? Number(shippingRate.amount).toFixed(2) : "0.00");
  const discountAmount = data.discountAmount ?? "0.00";
  const items = mergeOrderLines(data.items);

  const order = await prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: {
        id: {
          in: [...new Set(items.map((item) => item.productId))]
        },
        storeId: store.id,
        status: {
          not: "ARCHIVED"
        }
      },
      select: {
        id: true,
        images: {
          orderBy: {
            position: "asc"
          },
          select: {
            url: true
          },
          take: 1
        },
        price: true,
        sku: true,
        title: true
      }
    });
    const productsById = new Map(products.map((product) => [product.id, product]));
    const lines: OrderLineWrite[] = [];

    for (const item of items) {
      const product = productsById.get(item.productId);

      if (!product) {
        throw new Error("One of the selected products is no longer available.");
      }

      const variant = item.variantId
        ? await decrementProductVariantStock(
            tx,
            store.id,
            item.productId,
            item.variantId,
            item.quantity
          )
        : null;

      if (!variant) {
        const updated = await tx.product.updateMany({
          where: {
            id: item.productId,
            storeId: store.id,
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
          throw new Error(`${product.title} does not have enough stock.`);
        }
      }

      const price = item.price ?? Number(variant ? variant.price : product.price).toFixed(2);

      lines.push({
        imageUrl: variant?.imageUrl ?? product.images[0]?.url ?? null,
        price,
        productId: product.id,
        quantity: item.quantity,
        sku: variant?.sku ?? product.sku ?? null,
        title: variant ? `${product.title} - ${variant.title}` : product.title,
        total: (Number(price) * item.quantity).toFixed(2),
        variantId: variant?.id ?? null
      });
    }

    const subtotalAmount = lines.reduce((sum, line) => sum + Number(line.total), 0).toFixed(2);
    const totalAmount = (
      Number(subtotalAmount) +
      Number(shippingAmount) -
      Number(discountAmount)
    ).toFixed(2);

    if (Number(totalAmount) < 0) {
      throw new Error("The discount is larger than the order total.");
    }

    const customer = await tx.customer.upsert({
      where: {
        storeId_phone: {
          storeId: store.id,
          phone: data.customerPhone
        }
      },
      update: {
        name: data.customerName,
        ...(data.customerEmail ? { email: data.customerEmail } : {})
      },
      create: {
        storeId: store.id,
        name: data.customerName,
        phone: data.customerPhone,
        ...(data.customerEmail ? { email: data.customerEmail } : {})
      }
    });

    const address = await tx.address.create({
      data: {
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 ?? null,
        area: data.area ?? null,
        city: data.city ?? null,
        country: data.country,
        customerId: customer.id,
        district: data.district,
        email: data.customerEmail ?? null,
        name: data.customerName,
        phone: data.customerPhone,
        postalCode: data.postalCode ?? null,
        storeId: store.id
      }
    });

    const orderNumber = await generateOrderNumber(tx, store.id);

    return tx.order.create({
      data: {
        billingAddressId: address.id,
        currency: store.currency,
        customerEmail: data.customerEmail ?? null,
        customerId: customer.id,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        discountAmount,
        fulfillmentStatus: "UNFULFILLED",
        items: {
          create: lines
        },
        notes: data.notes ?? null,
        orderNumber,
        paymentMethodName: paymentMethod.name,
        paymentMethodType: paymentMethod.type,
        paymentNote: data.paymentNote ?? null,
        paymentReference: data.paymentReference ?? null,
        paymentStatus: data.paymentStatus,
        shippingAddressId: address.id,
        shippingAmount,
        shippingArea: shippingRate?.area ?? data.area ?? null,
        shippingCity: shippingRate?.city ?? data.city ?? null,
        shippingDistrict: shippingRate?.district ?? data.district,
        shippingRateId: shippingRate?.id ?? null,
        shippingRateName: shippingRate?.name ?? null,
        status: data.status,
        storeId: store.id,
        subtotalAmount,
        taxAmount: "0.00",
        totalAmount
      }
    });
  });

  // Outside the transaction and non-throwing, exactly as checkout does it: the
  // risk score is a review aid and must never fail an order already committed.
  await assessOrderSafely(store.id, order.id);

  return { order, sendSms: data.sendSms };
}

/**
 * Folds repeated lines for the same product option into one.
 *
 * Without this, two lines of the same product each pass the stock guard on their
 * own — `gte: 3` twice against 4 units in stock succeeds and leaves -2. Merging
 * first means one guarded decrement per option, which is also what the seller
 * meant by listing the product twice.
 */
function mergeOrderLines(items: ManualOrderItemInput[]) {
  const merged = new Map<string, ManualOrderItemInput>();

  for (const item of items) {
    const key = `${item.productId}::${item.variantId ?? ""}`;
    const existing = merged.get(key);

    if (existing) {
      existing.quantity += item.quantity;
      continue;
    }

    merged.set(key, { ...item });
  }

  return [...merged.values()];
}
