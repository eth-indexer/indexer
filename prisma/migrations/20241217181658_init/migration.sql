-- CreateTable
CREATE TABLE "Block" (
    "id" BIGSERIAL NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockHash" CHAR(66) NOT NULL,
    "parentBlockHash" CHAR(66) NOT NULL,
    "contractNonce" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "blockState" JSONB NOT NULL,
    "isFinalized" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyState" (
    "id" BIGSERIAL NOT NULL,
    "nonce" BIGINT NOT NULL,
    "keys" JSONB NOT NULL,

    CONSTRAINT "KeyState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KeyState_nonce_key" ON "KeyState"("nonce");

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_contractNonce_fkey" FOREIGN KEY ("contractNonce") REFERENCES "KeyState"("nonce") ON DELETE RESTRICT ON UPDATE CASCADE;
