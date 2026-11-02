import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.ts";

export const DEFAULT_MENU_IMAGE =
  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80";

let isProvisioned = false;

/**
 * Ensures the database has a complete, enterprise-grade default tenant, outlet, warehouse,
 * accounting periods, number sequences, units, chart of accounts, raw materials (Items),
 * inventory balances, FIFO layers, menus, recipes, suppliers, and QR menus.
 *
 * Also provides `resolveTenantContext(tenantHint?)` so any API request (whether from Demo Mode,
 * Google Auth, or X-Tenant-Id header) safely resolves to a valid Tenant + Outlet + Warehouse.
 */
export async function ensureEnterpriseProvisioning() {
  if (isProvisioned) return;

  try {
    let tenant = await prisma.tenant.findFirst({
      include: { outlets: true },
    });

    const now = new Date();
    const yearStr = String(now.getFullYear());
    const periodStr = `${yearStr}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          id: "aslam-brew",
          name: "LedgerLine Coffee & Roastery",
          slug: "ledgerline-roastery",
          plan: "business",
          status: "active",
          timezone: "Asia/Jakarta",
          config: JSON.stringify({
            storeName: "LedgerLine Coffee & Roastery",
            address: "Jl. Veteran No. 45, Jakarta Pusat",
            phone: "0812-3456-7890",
            taxPercentage: 11,
            serviceChargePercentage: 0,
            currency: "IDR",
            enableQrTable: true,
            storeWifiName: "LedgerLine_Guest_5G",
            qrisMerchantName: "LEDGERLINE ROASTERY ID",
          }),
        },
        include: { outlets: true },
      });
    }

    // 1. Ensure Default Warehouse
    let warehouse = await prisma.warehouse.findFirst({
      where: { tenantId: tenant.id },
    });
    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: {
          tenantId: tenant.id,
          name: "Gudang Utama Roastery",
          location: "Jakarta Pusat",
        },
      });
    }

    // 2. Ensure Default Outlet with defaultWarehouseId linked
    let outlet = await prisma.outlet.findFirst({
      where: { tenantId: tenant.id },
    });
    if (!outlet) {
      outlet = await prisma.outlet.create({
        data: {
          tenantId: tenant.id,
          name: "Outlet Utama",
          address: "Jl. Veteran No. 45, Jakarta Pusat",
          phone: "0812-3456-7890",
          defaultWarehouseId: warehouse.id,
        },
      });
    } else if (!outlet.defaultWarehouseId) {
      outlet = await prisma.outlet.update({
        where: { id: outlet.id },
        data: { defaultWarehouseId: warehouse.id },
      });
    }

    // 3. Ensure Active Accounting Period for Current Month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const existingPeriod = await prisma.period.findFirst({
      where: { tenantId: tenant.id, status: "OPEN" },
    });
    if (!existingPeriod) {
      await prisma.period.create({
        data: {
          tenantId: tenant.id,
          name: periodStr,
          startDate: startOfMonth,
          endDate: endOfMonth,
          status: "OPEN",
        },
      });
    }

    // 4. Ensure Number Sequences
    for (const prefix of ["INV", "PO", "RCV", "JRN"]) {
      const seq = await prisma.numberSequence.findUnique({
        where: {
          tenantId_prefix_year: {
            tenantId: tenant.id,
            prefix,
            year: yearStr,
          },
        },
      });
      if (!seq) {
        await prisma.numberSequence.create({
          data: {
            tenantId: tenant.id,
            prefix,
            year: yearStr,
            lastNumber: 0,
          },
        });
      }
    }

    // 5. Ensure Standard Units
    const unitDefs = [
      { name: "Gram", symbol: "g" },
      { name: "Kilogram", symbol: "kg" },
      { name: "Mililiter", symbol: "ml" },
      { name: "Liter", symbol: "liter" },
      { name: "Piece", symbol: "pcs" },
      { name: "Botol", symbol: "botol" },
      { name: "Pack", symbol: "pack" },
    ];
    const unitMap = new Map<string, string>();
    for (const u of unitDefs) {
      let unit = await prisma.unit.findUnique({
        where: { tenantId_symbol: { tenantId: tenant.id, symbol: u.symbol } },
      });
      if (!unit) {
        unit = await prisma.unit.create({
          data: { tenantId: tenant.id, name: u.name, symbol: u.symbol },
        });
      }
      unitMap.set(u.symbol, unit.id);
    }

    // 6. Ensure Standard Chart of Accounts
    const accountDefs = [
      { code: "KAS", name: "Kas Tunai", type: "ASSET", normalBalance: "DEBIT" },
      { code: "BANK", name: "Bank / Non-Tunai / QRIS", type: "ASSET", normalBalance: "DEBIT" },
      { code: "PERSEDIAAN", name: "Persediaan Bahan Baku", type: "ASSET", normalBalance: "DEBIT" },
      { code: "PPN_KELUARAN", name: "Hutang Pajak PPN", type: "LIABILITY", normalBalance: "CREDIT" },
      { code: "UTANG_USAHA", name: "Hutang Usaha Supplier", type: "LIABILITY", normalBalance: "CREDIT" },
      { code: "SERVICE_CHARGE", name: "Service Charge", type: "LIABILITY", normalBalance: "CREDIT" },
      { code: "PENDAPATAN", name: "Pendapatan Penjualan", type: "REVENUE", normalBalance: "CREDIT" },
      { code: "HPP", name: "Harga Pokok Penjualan", type: "EXPENSE", normalBalance: "DEBIT" },
      { code: "BEBAN_OPS", name: "Beban Operasional", type: "EXPENSE", normalBalance: "DEBIT" },
    ];
    for (const acc of accountDefs) {
      const existingAcc = await prisma.account.findUnique({
        where: { tenantId_code: { tenantId: tenant.id, code: acc.code } },
      });
      if (!existingAcc) {
        await prisma.account.create({
          data: {
            tenantId: tenant.id,
            code: acc.code,
            name: acc.name,
            type: acc.type,
            normalBalance: acc.normalBalance,
          },
        });
      }
    }

    // 6.5. Ensure Default Active TaxRate (PPN 11%)
    const existingTaxRate = await prisma.taxRate.findFirst({
      where: { tenantId: tenant.id, status: "ACTIVE" },
    });
    if (!existingTaxRate) {
      await prisma.taxRate.create({
        data: {
          tenantId: tenant.id,
          name: "PPN 11%",
          rate: 0.11,
          effectiveDate: new Date(2020, 0, 1),
          status: "ACTIVE",
        },
      });
    }

    // 7. Ensure Cost Allocation Config
    const costCfg = await prisma.costAllocationConfig.findUnique({
      where: { tenantId: tenant.id },
    });
    if (!costCfg) {
      await prisma.costAllocationConfig.create({
        data: {
          tenantId: tenant.id,
          monthlyOperationalExpense: 4500000,
          monthlyLaborExpense: 6000000,
          allocationMethod: "REVENUE",
        },
      });
    }

    // 8. Ensure Default Cashier/Owner UserProfile
    let defaultProfile = await prisma.userProfile.findFirst({
      where: { tenantId: tenant.id },
    });
    if (!defaultProfile) {
      const pinHash = await bcrypt.hash("123456", 10);
      defaultProfile = await prisma.userProfile.create({
        data: {
          userId: "cashier-01",
          tenantId: tenant.id,
          role: "Owner",
          fullName: "Owner / Kasir Utama",
          pinHash,
          status: "active",
          assignedOutlets: JSON.stringify(["*", outlet.id]),
        },
      });
    } else if (!defaultProfile.assignedOutlets || !defaultProfile.assignedOutlets.includes("*")) {
      await prisma.userProfile.update({
        where: { id: defaultProfile.id },
        data: {
          assignedOutlets: JSON.stringify(["*", outlet.id]),
        },
      });
    }

    // 9. Ensure Raw Materials (Items) + InventoryBalances + FIFO Layers
    const itemCount = await prisma.item.count({ where: { tenantId: tenant.id } });
    if (itemCount < 3) {
      const rawMaterialSeeds = [
        {
          sku: "RM-GAYO-01",
          name: "Arabica Gayo Special Roast (Biji Kopi)",
          category: "Bahan Baku",
          symbol: "g",
          price: 280,
          stock: 8500,
          minStock: 1000,
        },
        {
          sku: "RM-MILK-01",
          name: "Fresh Milk Full Cream Greenfields",
          category: "Dairy",
          symbol: "ml",
          price: 22,
          stock: 18000,
          minStock: 3000,
        },
        {
          sku: "RM-SYR-01",
          name: "Caramel Artisan Syrup Monin",
          category: "Syrup",
          symbol: "ml",
          price: 180,
          stock: 3500,
          minStock: 500,
        },
        {
          sku: "RM-MAT-01",
          name: "Ceremonial Uji Matcha Powder",
          category: "Powder",
          symbol: "g",
          price: 450,
          stock: 1500,
          minStock: 300,
        },
        {
          sku: "RM-CUP-01",
          name: "Paper Cup & Lid 12oz",
          category: "Packaging",
          symbol: "pcs",
          price: 1200,
          stock: 450,
          minStock: 50,
        },
      ];

      for (const rm of rawMaterialSeeds) {
        const unitId = unitMap.get(rm.symbol) || unitMap.get("pcs")!;
        const existingItem = await prisma.item.findUnique({
          where: { tenantId_sku: { tenantId: tenant.id, sku: rm.sku } },
        });
        const item =
          existingItem ||
          (await prisma.item.create({
            data: {
              tenantId: tenant.id,
              sku: rm.sku,
              name: rm.name,
              category: rm.category,
              unitId,
              price: rm.price,
              minStock: rm.minStock,
              status: "ACTIVE",
            },
          }));

        const bal = await prisma.inventoryBalance.findUnique({
          where: {
            tenantId_itemId_warehouseId: {
              tenantId: tenant.id,
              itemId: item.id,
              warehouseId: warehouse.id,
            },
          },
        });
        if (!bal) {
          await prisma.inventoryBalance.create({
            data: {
              tenantId: tenant.id,
              itemId: item.id,
              warehouseId: warehouse.id,
              currentStock: rm.stock,
              averageCost: rm.price,
              version: 0,
            },
          });

          await prisma.fifoLayer.create({
            data: {
              tenantId: tenant.id,
              itemId: item.id,
              warehouseId: warehouse.id,
              batchNumber: `BATCH-INIT-${rm.sku}`,
              quantity: rm.stock,
              remainingQty: rm.stock,
              unitCost: rm.price,
              layerDate: new Date(Date.now() - 7 * 86400000),
              isExhausted: false,
            },
          });
        }
      }
    }

    // 10. Ensure Menus & Recipes (with Images!)
    const allItems = await prisma.item.findMany({ where: { tenantId: tenant.id } });
    const coffeeItem = allItems.find((i) => i.name.toLowerCase().includes("kopi") || i.sku.includes("GAYO")) || allItems[0];
    const milkItem = allItems.find((i) => i.name.toLowerCase().includes("milk") || i.name.toLowerCase().includes("susu")) || coffeeItem;
    const cupItem = allItems.find((i) => i.name.toLowerCase().includes("cup") || i.name.toLowerCase().includes("gelas")) || coffeeItem;

    const defaultCatalog = [
      {
        name: "Espresso Single Origin Gayo",
        category: "Coffee",
        price: 22000,
        description: "18g Arabica Gayo Special Roast, Yield 36g, 9 Bar",
        imageUrl: "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80",
      },
      {
        name: "Cappuccino Classic",
        category: "Coffee",
        price: 28000,
        description: "Double Espresso Gayo + 180ml Silky Microfoam Fresh Milk",
        imageUrl: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80",
      },
      {
        name: "Caramel Macchiato",
        category: "Coffee",
        price: 34000,
        description: "Espresso + Fresh Milk + 20ml Monin Caramel Artisan Drizzle",
        imageUrl: "https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=600&q=80",
      },
      {
        name: "Cold Brew Signature Gayo",
        category: "Coffee",
        price: 30000,
        description: "Steeped 16 jam suhu rendah + Sentuhan Gula Aren Organik",
        imageUrl: "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80",
      },
      {
        name: "Matcha Latte Supreme",
        category: "Non-Coffee",
        price: 32000,
        description: "15g Ceremonial Uji Matcha Whisked + Steamed Fresh Milk",
        imageUrl: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80",
      },
      {
        name: "Artisan Butter Croissant",
        category: "Snacks",
        price: 25000,
        description: "French Butter Flaky Layers, baked fresh daily",
        imageUrl: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80",
      },
      {
        name: "Americano Ice Bold",
        category: "Coffee",
        price: 24000,
        description: "Double shot espresso over purified crystal ice and water",
        imageUrl: "https://images.unsplash.com/photo-1551030173-122aabc4489c?auto=format&fit=crop&w=600&q=80",
      },
      {
        name: "Truffle French Fries",
        category: "Snacks",
        price: 28000,
        description: "Shoestring fries, white truffle oil, parmesan, parsley",
        imageUrl: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80",
      },
      {
        name: "Smash Wagyu Cheeseburger",
        category: "Heavy Meals",
        price: 48000,
        description: "120g Wagyu beef patty, cheddar, brioche bun, secret burger sauce",
        imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",
      },
      {
        name: "Gayo Whole Beans 250g",
        category: "Beans",
        price: 85000,
        description: "Single origin Arabica Gayo, medium roast with valve bag",
        imageUrl: "https://images.unsplash.com/photo-1587734195503-904fca47e0e9?auto=format&fit=crop&w=600&q=80",
      },
    ];

    const existingMenus = await prisma.menu.findMany({
      where: { tenantId: tenant.id },
      include: { recipes: true },
    });

    if (existingMenus.length <= 2) {
      for (const m of defaultCatalog) {
        const found = existingMenus.find((em) => em.name.toLowerCase() === m.name.toLowerCase());
        if (!found) {
          const createdMenu = await prisma.menu.create({
            data: {
              tenantId: tenant.id,
              name: m.name,
              category: m.category,
              price: m.price,
              description: m.description,
              imageUrl: m.imageUrl,
              isActive: true,
            },
          });

          if (coffeeItem && cupItem) {
            await prisma.recipe.create({
              data: {
                tenantId: tenant.id,
                menuId: createdMenu.id,
                version: 1,
                effectiveFrom: new Date("2025-01-01"),
                details: {
                  create: [
                    {
                      tenantId: tenant.id,
                      itemId: coffeeItem.id,
                      unitId: coffeeItem.unitId,
                      quantity: m.category === "Coffee" ? 18 : 5,
                    },
                    ...(milkItem && milkItem.id !== coffeeItem.id && (m.name.includes("Latte") || m.name.includes("Cappuccino") || m.name.includes("Macchiato"))
                      ? [
                          {
                            tenantId: tenant.id,
                            itemId: milkItem.id,
                            unitId: milkItem.unitId,
                            quantity: 150,
                          },
                        ]
                      : []),
                  ],
                },
              },
            });
          }
        }
      }
    }

    // Ensure every menu has a recipe and imageUrl so checkout never fails with "Recipe not found"
    const allMenusNow = await prisma.menu.findMany({
      where: { tenantId: tenant.id },
      include: { recipes: true },
    });
    for (const menu of allMenusNow) {
      if (!menu.imageUrl) {
        const match = defaultCatalog.find((c) => c.name.toLowerCase().includes(menu.name.toLowerCase()));
        await prisma.menu.update({
          where: { id: menu.id },
          data: {
            imageUrl:
              match?.imageUrl ||
              "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80",
          },
        });
      }
      if (menu.recipes.length === 0 && coffeeItem) {
        await prisma.recipe.create({
          data: {
            tenantId: tenant.id,
            menuId: menu.id,
            version: 1,
            effectiveFrom: new Date("2025-01-01"),
            details: {
              create: [
                {
                  tenantId: tenant.id,
                  itemId: coffeeItem.id,
                  unitId: coffeeItem.unitId,
                  quantity: 10,
                },
              ],
            },
          },
        });
      }
    }

    // 11. Ensure Default Verified Suppliers & Catalog
    const supplierCount = await prisma.supplier.count();
    if (supplierCount === 0) {
      const supSeeds = [
        {
          name: "Koperasi Tani Gayo Highland",
          legalName: "Koperasi Produsen Kopi Gayo",
          contactEmail: "order@gayohighland.co.id",
          phone: "081234567890",
          address: "Jl. Takengon - Bireuen KM 5, Aceh Tengah",
          city: "Aceh Tengah",
          province: "Aceh",
          status: "VERIFIED",
          verifiedBy: "superadmin",
          verifiedAt: new Date(),
          catalog: [
            {
              name: "Biji Kopi Arabika Gayo Specialty Grade 1",
              category: "Beans",
              unit: "kg",
              price: 135000,
              stockQuantity: 500,
              moq: 5,
            },
            {
              name: "House Blend Espresso Crema Bold",
              category: "Beans",
              unit: "kg",
              price: 110000,
              stockQuantity: 350,
              moq: 5,
            },
          ],
        },
        {
          name: "PT Susu Murni Nusantara",
          legalName: "PT Susu Murni Nusantara Tbk",
          contactEmail: "b2b@susunusantara.id",
          phone: "082198765432",
          address: "Kawasan Industri Lembang No. 12, Bandung",
          city: "Bandung",
          province: "Jawa Barat",
          status: "VERIFIED",
          verifiedBy: "superadmin",
          verifiedAt: new Date(),
          catalog: [
            {
              name: "Fresh Milk Barista Edition Pasteurisasi",
              category: "Susu & Dairy",
              unit: "liter",
              price: 19500,
              stockQuantity: 1200,
              moq: 12,
            },
            {
              name: "Oat Milk Barista Blend",
              category: "Susu & Dairy",
              unit: "liter",
              price: 38000,
              stockQuantity: 400,
              moq: 6,
            },
          ],
        },
        {
          name: "Syrup & Sauce Indonesia Hub",
          legalName: "CV Rasa Nusantara Distribusi",
          contactEmail: "sales@syruphub.co.id",
          phone: "081911223344",
          address: "Jl. Rungkut Industri III No. 88, Surabaya",
          city: "Surabaya",
          province: "Jawa Timur",
          status: "VERIFIED",
          verifiedBy: "superadmin",
          verifiedAt: new Date(),
          catalog: [
            {
              name: "Monin Caramel Syrup 700ml",
              category: "Sirup & Flavour",
              unit: "botol",
              price: 145000,
              stockQuantity: 150,
              moq: 3,
            },
            {
              name: "Monin Vanilla Madagascar 700ml",
              category: "Sirup & Flavour",
              unit: "botol",
              price: 145000,
              stockQuantity: 120,
              moq: 3,
            },
          ],
        },
      ];

      for (const s of supSeeds) {
        const createdSup = await prisma.supplier.create({
          data: {
            name: s.name,
            legalName: s.legalName,
            contactEmail: s.contactEmail,
            phone: s.phone,
            address: s.address,
            city: s.city,
            province: s.province,
            status: s.status,
            verifiedBy: s.verifiedBy,
            verifiedAt: s.verifiedAt,
          },
        });
        for (const cat of s.catalog) {
          await prisma.supplierCatalog.create({
            data: {
              supplierId: createdSup.id,
              name: cat.name,
              category: cat.category,
              unit: cat.unit,
              price: cat.price,
              stockQuantity: cat.stockQuantity,
              moq: cat.moq,
              isActive: true,
            },
          });
        }
      }
    }

    // 12. Ensure Default QR Menu Tables
    const qrCount = await prisma.qrMenu.count({ where: { tenantId: tenant.id } });
    if (qrCount === 0) {
      const defaultTables = [
        { slug: "meja-01", number: "Meja 01", capacity: 4, status: "available" },
        { slug: "meja-02", number: "Meja 02", capacity: 2, status: "available" },
        { slug: "meja-03", number: "Meja 03", capacity: 6, status: "available" },
        { slug: "meja-04", number: "Meja 04", capacity: 4, status: "available" },
      ];
      for (const t of defaultTables) {
        await prisma.qrMenu.create({
          data: {
            tenantId: tenant.id,
            outletId: outlet.id,
            slug: t.slug,
            menuData: JSON.stringify(t),
          },
        });
      }
    }

    isProvisioned = true;
  } catch (err) {
    console.warn("Notice during enterprise provisioning:", err);
  }
}

/**
 * Resolves a tenantId, outletId, warehouseId, and cashierId safely.
 * If the caller passes "aslam-brew", undefined, or a non-existent ID,
 * it automatically resolves to the primary active tenant in the database
 * and ensures all required infrastructure (warehouse, outlet, open period, sequences) exists.
 */
export async function resolveTenantContext(tenantHint?: string, outletHint?: string) {
  await ensureEnterpriseProvisioning();

  let tenant = tenantHint
    ? await prisma.tenant.findFirst({
        where: {
          OR: [{ id: tenantHint }, { slug: tenantHint }],
        },
      })
    : null;

  if (!tenant) {
    tenant = await prisma.tenant.findFirst({
      orderBy: { createdAt: "asc" },
    });
  }

  if (!tenant) {
    throw new Error("No tenant available in database");
  }

  let warehouse = await prisma.warehouse.findFirst({
    where: { tenantId: tenant.id },
  });
  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        tenantId: tenant.id,
        name: "Gudang Utama",
        location: "Utama",
      },
    });
  }

  let outlet = outletHint
    ? await prisma.outlet.findFirst({
        where: { id: outletHint, tenantId: tenant.id },
      })
    : null;

  if (!outlet) {
    outlet = await prisma.outlet.findFirst({
      where: { tenantId: tenant.id },
    });
  }

  if (!outlet) {
    outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        name: "Outlet Utama",
        address: "Jakarta",
        defaultWarehouseId: warehouse.id,
      },
    });
  } else if (!outlet.defaultWarehouseId) {
    outlet = await prisma.outlet.update({
      where: { id: outlet.id },
      data: { defaultWarehouseId: warehouse.id },
    });
  }

  // Ensure open period for this tenant
  const now = new Date();
  const openPeriod = await prisma.period.findFirst({
    where: { tenantId: tenant.id, status: "OPEN" },
  });
  if (!openPeriod) {
    const yearStr = String(now.getFullYear());
    const periodStr = `${yearStr}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await prisma.period.create({
      data: {
        tenantId: tenant.id,
        name: periodStr,
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
        status: "OPEN",
      },
    });
  }

  return {
    tenant,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    outlet,
    outletId: outlet.id,
    warehouse,
    warehouseId: warehouse.id,
  };
}
