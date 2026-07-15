import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import {
  createPostgresAccessStore,
  registerAccessRoutes,
} from "./modules/access.js";
import { createPostgresAdminStore, registerAdminRoutes } from "./modules/admin.js";
import { createPostgresAuthStore, registerAuthRoutes } from "./modules/auth.js";
import { createPostgresCatalogStore, registerCatalogRoutes } from "./modules/catalog.js";
import { createPostgresLocationStore, registerLocationRoutes } from "./modules/locations.js";
import { createPostgresInventoryStore, registerInventoryRoutes } from "./modules/inventory.js";
import { createPostgresOutboundStore, registerOutboundRoutes } from "./modules/outbound.js";
import { registerPickingRoutes } from "./modules/picking.js";
import { registerCheckingRoutes } from "./modules/checking.js";
import { registerOutboundExceptionRoutes } from "./modules/outbound-exceptions.js";
import { registerPurchasingRoutes } from "./modules/purchasing.js";
import { registerSalesRoutes } from "./modules/sales.js";
import { registerReturnRoutes } from "./modules/returns.js";
import { registerStockCountRoutes } from "./modules/stock-counts.js";
import { registerTransferRoutes } from "./modules/transfers.js";
import { createPostgresPartnerStore, registerPartnerRoutes } from "./modules/partners.js";
import { createPostgresProductStore, registerProductRoutes } from "./modules/products.js";
import { createPostgresReceiptStore, registerReceiptRoutes } from "./modules/receipts.js";
import { createPostgresStockStore, registerStockRoutes } from "./modules/stock.js";

const app = createApp();
const authStore = createPostgresAuthStore(pool);
registerAuthRoutes(app, authStore, {
  sessionSecret: config.SESSION_SECRET,
  secureCookies: config.NODE_ENV === "production",
});
const accessStore = createPostgresAccessStore(pool);
registerAccessRoutes(app, authStore, accessStore, config.SESSION_SECRET);
registerAdminRoutes(
  app,
  authStore,
  accessStore,
  createPostgresAdminStore(pool),
  config.SESSION_SECRET,
);
registerCatalogRoutes(app, authStore, accessStore, createPostgresCatalogStore(pool), config.SESSION_SECRET);
registerLocationRoutes(app, authStore, accessStore, createPostgresLocationStore(pool), config.SESSION_SECRET);
registerInventoryRoutes(app, authStore, accessStore, createPostgresInventoryStore(pool), config.SESSION_SECRET);
registerOutboundRoutes(app, authStore, accessStore, createPostgresOutboundStore(pool), config.SESSION_SECRET);
registerPickingRoutes(app, authStore, accessStore, pool, config.SESSION_SECRET);
registerCheckingRoutes(app, authStore, accessStore, pool, config.SESSION_SECRET);
registerOutboundExceptionRoutes(app, authStore, accessStore, pool, config.SESSION_SECRET);
registerPurchasingRoutes(app, authStore, accessStore, pool, config.SESSION_SECRET);
registerSalesRoutes(app, authStore, accessStore, pool, config.SESSION_SECRET);
registerReturnRoutes(app, authStore, accessStore, pool, config.SESSION_SECRET);
registerStockCountRoutes(app, authStore, accessStore, pool, config.SESSION_SECRET);
registerTransferRoutes(app, authStore, accessStore, pool, config.SESSION_SECRET);
registerPartnerRoutes(app, authStore, accessStore, createPostgresPartnerStore(pool), config.SESSION_SECRET);
registerProductRoutes(app, authStore, accessStore, createPostgresProductStore(pool), config.SESSION_SECRET);
registerStockRoutes(app, authStore, accessStore, createPostgresStockStore(pool), config.SESSION_SECRET);
registerReceiptRoutes(app, authStore, accessStore, createPostgresReceiptStore(pool), config.SESSION_SECRET);

serve(
  {
    fetch: app.fetch,
    port: config.PORT,
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  },
);
