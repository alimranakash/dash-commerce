import { prisma, type Prisma } from "@dash/db";
import type { ShippingRateInput, ShippingZoneInput } from "./shipping.schema";

export const defaultShippingZones = [
  {
    name: "Inside Dhaka",
    description: "Delivery inside Dhaka city.",
    isEnabled: true,
    sortOrder: 0,
    rate: {
      name: "Inside Dhaka delivery",
      district: "Dhaka",
      city: "Dhaka",
      area: null,
      amount: "70.00",
      isEnabled: true,
      sortOrder: 0
    }
  },
  {
    name: "Outside Dhaka",
    description: "Delivery anywhere outside Dhaka.",
    isEnabled: true,
    sortOrder: 10,
    rate: {
      name: "Outside Dhaka delivery",
      district: null,
      city: null,
      area: null,
      amount: "130.00",
      isEnabled: true,
      sortOrder: 10
    }
  }
] as const;

export type ShippingTransaction = Prisma.TransactionClient;
type ExistingShippingRateInput = ShippingRateInput & {
  id: string;
};

export async function createDefaultShippingRecords(
  tx: ShippingTransaction,
  storeId: string
) {
  for (const zone of defaultShippingZones) {
    const createdZone = await tx.shippingZone.create({
      data: {
        storeId,
        name: zone.name,
        description: zone.description,
        isEnabled: zone.isEnabled,
        sortOrder: zone.sortOrder
      },
      select: {
        id: true
      }
    });

    await tx.shippingRate.create({
      data: {
        storeId,
        zoneId: createdZone.id,
        ...zone.rate
      }
    });
  }
}

export async function getShippingZonesRecord(storeId: string) {
  return prisma.shippingZone.findMany({
    where: {
      storeId
    },
    include: {
      rates: {
        orderBy: [
          {
            sortOrder: "asc"
          },
          {
            createdAt: "asc"
          }
        ]
      }
    },
    orderBy: [
      {
        sortOrder: "asc"
      },
      {
        createdAt: "asc"
      }
    ]
  });
}

export async function getEnabledShippingRatesRecord(storeId: string) {
  return prisma.shippingRate.findMany({
    where: {
      storeId,
      isEnabled: true,
      zone: {
        isEnabled: true
      }
    },
    include: {
      zone: true
    },
    orderBy: [
      {
        sortOrder: "asc"
      },
      {
        createdAt: "asc"
      }
    ]
  });
}

export async function getEnabledShippingRateRecord(storeId: string, rateId: string) {
  return prisma.shippingRate.findFirst({
    where: {
      id: rateId,
      storeId,
      isEnabled: true,
      zone: {
        isEnabled: true
      }
    },
    include: {
      zone: true
    }
  });
}

export async function ensureDefaultShippingRecords(storeId: string) {
  await prisma.$transaction(async (tx) => {
    const zones = await tx.shippingZone.findMany({
      where: {
        storeId
      },
      select: {
        id: true,
        name: true
      }
    });

    if (zones.length === 0) {
      await createDefaultShippingRecords(tx, storeId);
      return;
    }

    const ratesCount = await tx.shippingRate.count({
      where: {
        storeId
      }
    });

    if (ratesCount > 0) {
      return;
    }

    for (const defaultZone of defaultShippingZones) {
      const zone =
        zones.find((entry) => entry.name.toLowerCase() === defaultZone.name.toLowerCase()) ??
        zones[0];

      if (!zone) {
        throw new Error("Shipping zone setup failed.");
      }

      await tx.shippingRate.create({
        data: {
          storeId,
          zoneId: zone.id,
          ...defaultZone.rate
        }
      });
    }
  });

  return getShippingZonesRecord(storeId);
}

export async function updateShippingSettingsRecord(
  storeId: string,
  input: {
    deleteRateIds: string[];
    newRate?: ShippingRateInput;
    rates: ExistingShippingRateInput[];
    zones: ShippingZoneInput[];
  }
) {
  await prisma.$transaction(async (tx) => {
    const zoneIds = input.zones.map((zone) => zone.id);
    const existingZones = await tx.shippingZone.findMany({
      where: {
        id: {
          in: zoneIds
        },
        storeId
      },
      select: {
        id: true
      }
    });
    const allowedZoneIds = new Set(existingZones.map((zone) => zone.id));

    if (allowedZoneIds.size !== zoneIds.length) {
      throw new Error("One or more shipping zones could not be found.");
    }

    for (const zone of input.zones) {
      await tx.shippingZone.update({
        where: {
          id: zone.id,
          storeId
        },
        data: {
          description: zone.description ?? null,
          isEnabled: zone.isEnabled,
          sortOrder: zone.sortOrder
        }
      });
    }

    if (input.deleteRateIds.length > 0) {
      await tx.shippingRate.deleteMany({
        where: {
          id: {
            in: input.deleteRateIds
          },
          storeId
        }
      });
    }

    for (const rate of input.rates) {
      if (!allowedZoneIds.has(rate.zoneId)) {
        throw new Error("One or more shipping rates reference an invalid zone.");
      }

      await tx.shippingRate.update({
        where: {
          id: rate.id,
          storeId
        },
        data: shippingRateData(rate)
      });
    }

    if (input.newRate) {
      if (!allowedZoneIds.has(input.newRate.zoneId)) {
        throw new Error("Choose a valid zone for the new shipping rate.");
      }

      await tx.shippingRate.create({
        data: {
          storeId,
          ...shippingRateData(input.newRate)
        }
      });
    }
  });

  return getShippingZonesRecord(storeId);
}

function shippingRateData(rate: ShippingRateInput) {
  return {
    zoneId: rate.zoneId,
    name: rate.name,
    district: rate.district ?? null,
    city: rate.city ?? null,
    area: rate.area ?? null,
    amount: rate.amount,
    isEnabled: rate.isEnabled,
    sortOrder: rate.sortOrder
  };
}
