-- CreateTable
CREATE TABLE "runtimes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "runtimes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_providers" (
    "id" TEXT NOT NULL,
    "runtime_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "discovered" BOOLEAN NOT NULL,
    "available" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "resolved_path" TEXT,
    "version" TEXT,
    "unavailable_reason" TEXT,
    CONSTRAINT "runtime_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "runtimes_updated_at_id_idx" ON "runtimes"("updated_at", "id");

-- CreateIndex
CREATE INDEX "runtimes_created_at_id_idx" ON "runtimes"("created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "runtime_providers_runtime_id_provider_key" ON "runtime_providers"("runtime_id", "provider");

-- AddForeignKey
ALTER TABLE "runtime_providers" ADD CONSTRAINT "runtime_providers_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
