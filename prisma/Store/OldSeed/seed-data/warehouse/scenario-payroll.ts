import { endOfMonth, money, startOfMonth } from "./helpers";
import type { TxClient, WarehouseSeedContext } from "./types";

export async function seedWarehousePayroll(
  prisma: TxClient,
  ctx: WarehouseSeedContext,
): Promise<WarehouseSeedContext> {
  const deliveryKeys = ["delivery1", "delivery2", "delivery3", "delivery4", "delivery5"];
  const warehouseKeys = Object.keys(ctx.warehouses);

  const period = await prisma.payrollPeriod.upsert({
    where: {
      startDate_endDate: {
        startDate: startOfMonth(0),
        endDate: endOfMonth(0),
      },
    },
    update: {
      name: "Warehouse Demo Payroll Current Month",
      status: "OPEN",
      notes: "Seeded warehouse payroll period",
    },
    create: {
      name: "Warehouse Demo Payroll Current Month",
      startDate: startOfMonth(0),
      endDate: endOfMonth(0),
      status: "OPEN",
      notes: "Seeded warehouse payroll period",
    },
    select: { id: true },
  });
  ctx.payrollPeriodId = period.id;

  for (const [index, deliveryKey] of deliveryKeys.entries()) {
    const warehouseKey = warehouseKeys[index % warehouseKeys.length];
    const warehouseId = ctx.warehouses[warehouseKey];
    const userId = ctx.users[deliveryKey];
    const baseSalary = 18000 + index * 1500;
    const overtime = index * 500;
    const bonus = index % 2 === 0 ? 1000 : 500;
    const deduction = index === 3 ? 300 : 0;
    const net = baseSalary + overtime + bonus - deduction;

    const profile = await prisma.payrollProfile.upsert({
      where: { userId },
      update: {
        warehouseId,
        employeeCode: `WH-PAY-${String(index + 1).padStart(3, "0")}`,
        paymentType: "MONTHLY",
        baseSalary: money(baseSalary),
        bankName: index % 2 === 0 ? "DBBL" : "BRAC Bank",
        bankAccountNo: `30000000000${index + 1}`,
        accountHolder: `Warehouse Delivery Man ${index + 1}`,
        mobileBankingNo: `0182200000${index + 1}`,
        paymentMethod: index % 2 === 0 ? "BANK" : "MFS",
        joiningDate: new Date(new Date().getFullYear(), 0, index + 1),
        isActive: true,
        notes: "Seeded warehouse payroll profile",
      },
      create: {
        userId,
        warehouseId,
        employeeCode: `WH-PAY-${String(index + 1).padStart(3, "0")}`,
        paymentType: "MONTHLY",
        baseSalary: money(baseSalary),
        bankName: index % 2 === 0 ? "DBBL" : "BRAC Bank",
        bankAccountNo: `30000000000${index + 1}`,
        accountHolder: `Warehouse Delivery Man ${index + 1}`,
        mobileBankingNo: `0182200000${index + 1}`,
        paymentMethod: index % 2 === 0 ? "BANK" : "MFS",
        joiningDate: new Date(new Date().getFullYear(), 0, index + 1),
        isActive: true,
        notes: "Seeded warehouse payroll profile",
      },
      select: { id: true },
    });
    ctx.payrollProfiles[deliveryKey] = profile.id;

    const entry = await prisma.payrollEntry.upsert({
      where: {
        payrollPeriodId_payrollProfileId: {
          payrollPeriodId: period.id,
          payrollProfileId: profile.id,
        },
      },
      update: {
        userId,
        warehouseId,
        basicAmount: money(baseSalary),
        overtimeAmount: money(overtime),
        bonusAmount: money(bonus),
        deductionAmount: money(deduction),
        netAmount: money(net),
        paymentStatus: index < 2 ? "PAID" : "PENDING",
        paidAt: index < 2 ? new Date() : null,
        note: "Seeded warehouse payroll entry",
      },
      create: {
        payrollPeriodId: period.id,
        payrollProfileId: profile.id,
        userId,
        warehouseId,
        basicAmount: money(baseSalary),
        overtimeAmount: money(overtime),
        bonusAmount: money(bonus),
        deductionAmount: money(deduction),
        netAmount: money(net),
        paymentStatus: index < 2 ? "PAID" : "PENDING",
        paidAt: index < 2 ? new Date() : null,
        note: "Seeded warehouse payroll entry",
      },
      select: { id: true },
    });

    await prisma.payrollAdjustment.create({
      data: {
        payrollEntryId: entry.id,
        type: bonus > deduction ? "BONUS" : "DEDUCTION",
        amount: money(bonus > deduction ? bonus : deduction),
        reason: bonus > deduction ? "Seeded monthly performance bonus" : "Seeded attendance deduction",
      },
    });
  }

  return ctx;
}
