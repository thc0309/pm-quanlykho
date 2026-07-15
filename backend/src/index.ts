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

serve(
  {
    fetch: app.fetch,
    port: config.PORT,
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  },
);
