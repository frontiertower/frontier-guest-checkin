import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  priority?: boolean;
}

const sizeConfig = {
  sm: {
    width: 48,
    height: 48,
    className: "h-12 w-12"
  },
  md: {
    width: 64,
    height: 64,
    className: "h-16 w-16"
  },
  lg: {
    width: 80,
    height: 80,
    className: "h-20 w-20"
  },
  xl: {
    width: 96,
    height: 96,
    className: "h-24 w-24"
  }
};

export function Logo({ size = "md", className, priority = false }: LogoProps) {
  const config = sizeConfig[size];

  return (
    <Image
      src="/logo.JPG"
      alt="Frontier Tower Logo"
      width={config.width}
      height={config.height}
      className={cn(
        config.className, 
        "object-contain transition-transform duration-300 hover:scale-105",
        className
      )}
      priority={priority}
    />
  );
}