import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/database";

async function main() {
  console.log("🌱 Starting database seed...");

  // 1. Seed Default Owner
  const ownerUsername = "admin";
  const existingOwner = await prisma.user.findUnique({
    where: { username: ownerUsername },
  });

  if (!existingOwner) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("admin123", salt);

    await prisma.user.create({
      data: {
        username: ownerUsername,
        fullName: "Primary Owner / Administrator",
        passwordHash,
        role: Role.OWNER,
      },
    });
    console.log("✅ Default Owner created: admin / admin123");
  } else {
    console.log("ℹ️ Owner already exists.");
  }

  // 2. Seed Standard Expense Categories
  const standardCategories = [
    "Transport & Freight",
    "Loading / Labor (Hamali)",
    "Fuel & Generator",
    "Harvesting Machinery",
    "Warehouse Rent",
    "Office & Utilities",
    "Gunny Sacks (Bardana)",
  ];

  for (const name of standardCategories) {
    await prisma.expenseCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log("✅ Standard expense categories seeded.");

  console.log("🌾 Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
