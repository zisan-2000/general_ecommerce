import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma"; // Import your Prisma client

// Helper function to handle both Resend and Prisma updates
async function handleUnsubscribe(email: string) {
    const resendEmail = email.trim().toLowerCase();

    let isResendUpdated = false;
    let resendError: string | null = null;

    // Only try Resend if configured
    if (process.env.RESEND_API_KEY && process.env.RESEND_AUDIENCE_ID) {
        // 1. Update contact in Resend Audience
        try {
            const resend = new Resend(process.env.RESEND_API_KEY);
            // Use contacts.update to set unsubscribed: true
            const { error } = await resend.contacts.update({
                audienceId: process.env.RESEND_AUDIENCE_ID,
                email: resendEmail,
                unsubscribed: true,
            });

            if (error) {
                // Handle Resend specific errors (e.g., email not found)
                if (error.message?.includes('not found')) {
                    // We'll proceed to check the local DB, but log the Resend error
                    console.warn(`Resend Warning: Contact ${resendEmail} not found in audience.`);
                } else {
                    resendError = error.message;
                    console.error("Resend Error:", resendError);
                }
            }
            isResendUpdated = true;
        } catch (e) {
            console.error("Resend unsubscribe error:", e);
            resendError = e instanceof Error ? e.message : "Unknown Resend error";
        }
    } else {
        console.warn("Resend not configured - only updating local database");
    }

    // 2. Update local Prisma Database
    try {
        const subscriber = await prisma.newsletterSubscriber.update({
            where: { email: resendEmail },
            data: {
                status: "unsubscribed",
                unsubscribedAt: new Date(),
            },
        });
        return { success: true, subscriber, resendError };
    } catch (dbError) {
        // P2025: Record to update not found (email was not in local DB)
        if (dbError instanceof Error && dbError.message.includes("Record to update not found")) {
            console.warn(`Prisma Warning: Subscriber ${resendEmail} not found in local database.`);
            return { success: false, error: "Email not found in local subscription list." };
        }
        throw dbError;
    }
}

// ------------------------------------------------------------------------------------------------

// GET handler (for link in email footer): /api/newsletter/unsubscribe?email=...
export async function GET(req: Request) {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");

    if (!email) {
        return new Response(
            `<html><body><h2>ইমেইল ঠিকানা আবশ্যক।</h2></body></html>`,
            { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
    }

    try {
        const result = await handleUnsubscribe(email);

        if (result.success) {
            return new Response(
                `<html>
                    <head>
                        <title>সফলভাবে আনসাবস্ক্রাইব করা হয়েছে</title>
                        <style>body { font-family: sans-serif; text-align: center; padding: 50px; background-color: #f0f0f0; } h2 { color: #0E4B4B; }</style>
                    </head>
                    <body>
                        <h2>✅ আপনি সফলভাবে নিউজলেটার থেকে আনসাবস্ক্রাইব করেছেন।</h2>
                        <p>আমরা আপনাকে আর কোনো ইমেইল পাঠাব না।</p>
                    </body>
                </html>`,
                { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
            );
        } else {
             // Handle case where email was not found in local DB
             return new Response(
                `<html>
                    <head>
                        <title>আনসাবস্ক্রাইব ব্যর্থ</title>
                        <style>body { font-family: sans-serif; text-align: center; padding: 50px; background-color: #f0f0f0; } h2 { color: #C0704D; }</style>
                    </head>
                    <body>
                        <h2>⚠️ আনসাবস্ক্রাইব করার অনুরোধটি ব্যর্থ হয়েছে।</h2>
                        <p>এই ইমেইলটি আমাদের গ্রাহক তালিকায় পাওয়া যায়নি।</p>
                    </body>
                </html>`,
                { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
            );
        }
    } catch (error) {
        console.error("Newsletter unsubscribe error:", error);
        return new Response(
            `<html><body><h2>আনসাবস্ক্রাইব করতে সমস্যা হয়েছে। অনুগ্রহ করে পরে চেষ্টা করুন।</h2></body></html>`,
            { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
    }
}

// ------------------------------------------------------------------------------------------------

// POST handler (Optional: JSON-based unsubscribe via frontend fetch)
export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: "ইমেইল ঠিকানা আবশ্যক" }, { status: 400 });
        }
        
        const result = await handleUnsubscribe(email);

        if (result.success) {
            return NextResponse.json({
                message: "আপনি সফলভাবে আনসাবস্ক্রাইব করেছেন!",
                subscriber: result.subscriber,
            });
        } else {
            // Error when email not found in local DB
            return NextResponse.json(
                {
                    error: "এই ইমেইলটি সাবস্ক্রিপশন তালিকায় পাওয়া যায়নি।",
                },
                { status: 404 }
            );
        }
    } catch (error) {
        console.error("Newsletter unsubscribe error:", error);
        return NextResponse.json(
            { error: "আনসাবস্ক্রাইব করতে সমস্যা হয়েছে" },
            { status: 500 }
        );
    }
}
