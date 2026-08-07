import { defineConfig } from "prisma/config";

const datasourceUrl = process.env.MYSTRA_PRISMA_SQLITE_URL;

export default defineConfig({
  schema: "schema.prisma",
  migrations: {
    path: "migrations",
  },
  ...(datasourceUrl ? { datasource: { url: datasourceUrl } } : {}),
});
