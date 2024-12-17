/*
  Warnings:

  - You are about to drop the column `isFinalized` on the `Block` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Block" DROP COLUMN "isFinalized";
