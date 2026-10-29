"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import GradientBorder from "@/components/ui/GradientBorder";

interface Banner {
  id: number;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  image: string;
  mobileImage?: string | null;
  buttonText?: string | null;
  buttonLink?: string | null;
  position: number;
  isActive: boolean;
  startDate?: string | null;
  endDate?: string | null;
  type: string;
}

interface PopupBannerProps {
  banners: Banner[];
}

export default function PopupBanner({ banners }: PopupBannerProps) {
  const [showPopup, setShowPopup] = useState(false);
  const popupBanner = banners.find((b) => b.type === "POPUP");

  useEffect(() => {
    if (popupBanner) {
      const timer = setTimeout(() => {
        setShowPopup(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [popupBanner]);

  if (!showPopup || !popupBanner) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <GradientBorder>
        <div className="relative card-theme bg-secondary rounded-2xl shadow-xl md:w-[35vw] w-[90vw] max-w-[500px] p-6">
          {/* Close Button */}
          <button
            onClick={() => setShowPopup(false)}
            className="absolute top-3 right-3 bg-destructive hover:bg-destructive/80 px-[6px] rounded-full hover:text-white text-white text-xl transition"
          >
            ✕
          </button>

          {/* Image */}
          {popupBanner.buttonLink ? (
            <Link href={popupBanner.buttonLink} className="relative block h-80 w-full">
              <Image
                src={popupBanner.image}
                alt={popupBanner.title}
                fill
                className="rounded object-contain"
              />
            </Link>
          ) : (
            <div className="relative h-80 w-full">
              <Image
                src={popupBanner.image}
                alt={popupBanner.title}
                fill
                className="rounded object-contain"
              />
            </div>
          )}

          {/* Button */}
          {popupBanner.buttonText && popupBanner.buttonLink && (
            <div className="mt-5 text-center">
              <Link
                href={popupBanner.buttonLink}
                className="btn-primary px-6 py-2 rounded-md inline-block transition"
              >
                {popupBanner.buttonText}
              </Link>
            </div>
          )}
        </div>
      </GradientBorder>
    </div>
  );
}
