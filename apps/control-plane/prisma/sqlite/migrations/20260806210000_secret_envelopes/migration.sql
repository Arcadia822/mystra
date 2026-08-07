-- CreateTable
CREATE TABLE "secret_envelopes" (
    "reference" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL,
    "algorithm" TEXT NOT NULL,
    "key_id" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "ciphertext_iv" TEXT NOT NULL,
    "ciphertext_auth_tag" TEXT NOT NULL,
    "wrapped_data_key" TEXT NOT NULL,
    "wrapped_data_key_iv" TEXT NOT NULL,
    "wrapped_data_key_auth_tag" TEXT NOT NULL,
    "created_at" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "secret_envelopes_created_at_reference_idx" ON "secret_envelopes"("created_at", "reference");
