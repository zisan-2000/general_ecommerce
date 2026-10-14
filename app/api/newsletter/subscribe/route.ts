import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma"; // আপনার Prisma ক্লায়েন্ট ইমপোর্ট করুন

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    // 1. ইনপুট যাচাই (Input Validation)
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "অনুগ্রহ করে একটি বৈধ ইমেইল ঠিকানা দিন" },
        { status: 400 }
      );
    }

    const resendEmail = email.trim().toLowerCase(); // ইমেইল কেস-ইনসেনসিটিভ করার জন্য

    let resendContact: unknown;
    let isAlreadyInResend = false;
    let resendError: string | null = null;

    // Only try Resend if configured
    if (process.env.RESEND_API_KEY && process.env.RESEND_AUDIENCE_ID) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        // Resend SDK ব্যবহার করে কন্টাক্ট তৈরি
        const { data, error } = await resend.contacts.create({
          audienceId: process.env.RESEND_AUDIENCE_ID!,
          email: resendEmail,
          unsubscribed: false, // নিশ্চিত করা হলো যে সাবস্ক্রাইবড অবস্থায় আছে
        });

        if (error) {
          if (error.message?.includes("The contact already exists")) {
            console.warn("Resend Warning: Contact already exists in audience.");
            isAlreadyInResend = true;
          } else {
            resendError = error.message;
            console.error("Resend Error:", resendError);
          }
        } else {
          resendContact = data;
        }
      } catch (e) {
        console.error("Resend Exception:", e);
        resendError = e instanceof Error ? e.message : "Unknown Resend error";
      }
    } else {
      console.warn("Resend not configured - only storing in local database");
    }
    try {
      const subscriber = await prisma.newsletterSubscriber.upsert({
        where: { email: resendEmail },
        update: {
          status: "subscribed",
          unsubscribedAt: null,
        },
        create: {
          email: resendEmail,
          status: "subscribed",
        },
      });

      // 4. সাফল্য রেসপন্স
      const message = resendError 
        ? "সফলভাবে নিউজলেটারের জন্য সাবস্ক্রাইব করা হয়েছে! (Resend সমস্যা সত্ত্বেও)"
        : "সফলভাবে নিউজলেটারের জন্য সাবস্রাইব করা হয়েছে!";

      return NextResponse.json({
        message,
        subscriber: subscriber,
        resendStatus: isAlreadyInResend
          ? "Already in Resend"
          : resendError
          ? "Resend Error"
          : process.env.RESEND_API_KEY && process.env.RESEND_AUDIENCE_ID
          ? "Added to Resend"
          : "Resend not configured",
      });
    } catch (dbError) {
      // Unique constraint error (যদি কোনো কারণে Resend-এর আগে DB error হয়)
      if (
        dbError instanceof Error &&
        dbError.message.includes("Unique constraint failed")
      ) {
        return NextResponse.json(
          { error: "এই ইমেইলটি ইতিমধ্যেই সাবস্ক্রাইব করা হয়েছে" },
          { status: 409 }
        );
      }

      console.error("Prisma subscription error:", dbError);
      return NextResponse.json(
        { error: "সাবস্ক্রিপশন ডেটাবেসে সংরক্ষণ করা সম্ভব হয়নি" },
        { status: 500 }
      );
    }
  } catch (e) {
    console.error("Newsletter subscription general error:", e);
    return NextResponse.json(
      { error: "সাবস্ক্রিপশন প্রক্রিয়া সম্পূর্ণ করা সম্ভব হয়নি" },
      { status: 500 }
    );
  }
}
