import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createInvoicePdf } from "@/lib/invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------- SITE INFO ----------
const SITE_NAME = "ECOMMERCE";
const SITE_WEBSITE = "www.example.com";
const SITE_EMAIL = "support@example.com";
const SITE_PHONE = "+880-XXXXXXXXXX";
const SITE_ADDRESS =
  "Level 2, House 1A, Road 16/A, Gulshan-1, Dhaka 1212.";

// Fetch site settings from database
async function getSiteSettings() {
  try {
    const response = await fetch(
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/site`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (response.ok) {
      const settings = await response.json();

      return {
        SITE_NAME: settings.siteTitle || SITE_NAME,

        SITE_WEBSITE: settings.siteTitle
          ? settings.siteTitle.toLowerCase().replace(/\s+/g, "") + ".com"
          : SITE_WEBSITE,

        SITE_EMAIL: settings.contactEmail || SITE_EMAIL,

        SITE_PHONE: settings.contactNumber || SITE_PHONE,

        SITE_ADDRESS: settings.address || SITE_ADDRESS,
      };
    }
  } catch (error) {
    console.error("Failed to fetch site settings:", error);
  }

  return {
    SITE_NAME,
    SITE_WEBSITE,
    SITE_EMAIL,
    SITE_PHONE,
    SITE_ADDRESS,
  };
}

// ---------- HELPERS ----------
function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function safeText(v: any, fallback = "—") {
  const s = String(v ?? "").trim();

  return s ? s : fallback;
}

function getAppBaseUrl(req: Request) {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL;

  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  return new URL(req.url).origin.replace(/\/+$/, "");
}

// =====================================================
// GET
// =====================================================

export async function GET(
  req: Request,
  {
    params,
  }: {
    params: Promise<{
      orderId: string;
    }>;
  }
) {
  try {
    // ================= AUTH =================

    const session = await getServerSession(authOptions);

    if (!session?.user || !(session.user as any).id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const userId = (session.user as any).id as string;

    const sessionName =
      session.user.name || "Customer";

    const sessionEmail =
      session.user.email || "";

    // ================= ORDER ID =================

    const { orderId } = await params;

    const id = Number.parseInt(
      String(orderId),
      10
    );

    if (!Number.isFinite(id)) {
      return NextResponse.json(
        {
          error: "Invalid order id",
        },
        {
          status: 400,
        }
      );
    }

    // ================= FETCH ORDER =================

    const order = await db.order.findFirst({
      where: {
        id,
        userId,
      },

      select: {
        id: true,

        createdAt: true,

        status: true,

        paymentStatus: true,

        payment_method: true,

        grand_total: true,

        total: true,

        currency: true,

        Vat_total: true,

        discount_total: true,

        taxSnapshot: true,

        coupon: {
          select: {
            id: true,

            code: true,

            discountType: true,

            discountValue: true,
          },
        },

        orderItems: {
          select: {
            id: true,

            productId: true,

            price: true,

            quantity: true,

            VatAmount: true,

            product: {
              select: {
                name: true,

                sku: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        {
          error: "Order not found",
        },
        {
          status: 404,
        }
      );
    }

    // ================= USER PROFILE =================

    const userProfile =
      await db.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          phone: true,
        },
      });

    const sessionPhone =
      userProfile?.phone || "—";

    // ================= ORDER DATA =================

    const currency =
      order.currency || "BDT";

    const invoiceId =
      `INV${String(order.id).padStart(
        9,
        "0"
      )}`;

    const orderDate =
      formatDate(
        new Date(order.createdAt)
      );

    const orderRef =
      String(order.id);

    const invoiceQrValue =
      `${getAppBaseUrl(
        req
      )}/ecommerce/user/orders/${order.id}`;

    const items =
      order.orderItems ?? [];

    // ================= CALCULATIONS =================

    const subTotal = items.reduce(
      (sum, item) => {
        return (
          sum +
          Number(item.price ?? 0) *
            Number(item.quantity ?? 1)
        );
      },
      0
    );

    const vatTotal =
      Number(order.Vat_total ?? 0);

    const discountTotal =
      Number(
        order.discount_total ?? 0
      );

    const taxCharge = Number(
      (
        order.taxSnapshot as {
          totalTaxCharge?: number;
        } | null
      )?.totalTaxCharge ?? vatTotal
    );

    const grand = Number(
      order.grand_total ??
        order.total ??
        subTotal
    );

    const delivery = Math.max(
      grand -
        subTotal -
        taxCharge +
        discountTotal,
      0
    );

    // ================= SITE SETTINGS =================

    const siteSettings =
      await getSiteSettings();

    const pdfBytes = await createInvoicePdf({
      invoiceId,
      orderRef,
      orderDate,
      paymentMethod: safeText(order.payment_method, "Online"),
      paymentStatus: safeText(order.paymentStatus).replace(/_/g, " "),
      currency,
      orderUrl: invoiceQrValue,
      customer: {
        name: safeText(sessionName),
        email: safeText(sessionEmail),
        phone: safeText(sessionPhone),
      },
      site: siteSettings,
      items: items.map((item) => ({
        name: item.product?.name
          ? safeText(item.product.name)
          : `Product #${safeText(item.productId)}`,
        sku: safeText(item.product?.sku),
        quantity: Number(item.quantity ?? 1),
        price: Number(item.price ?? 0),
      })),
      subtotal: subTotal,
      delivery,
      tax: taxCharge,
      discount: discountTotal,
      couponCode: order.coupon?.code,
      grandTotal: grand,
    });

    // ================= SAVE PDF =================

    return new NextResponse(
      new Uint8Array(
        pdfBytes
      ),
      {
        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `attachment; filename="Invoice-${order.id}.pdf"`,

          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (err: any) {
    console.error(
      "Invoice PDF error:",
      err
    );

    return NextResponse.json(
      {
        error:
          "Failed to generate invoice",

        details:
          err?.message ||
          String(err),
      },
      {
        status: 500,
      }
    );
  }
}