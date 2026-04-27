import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  small?: boolean;
  variant?: "auto" | "dark" | "light";
}

// Image-based wordmark mirroring the Expert Network treatment.
// - `small` is the compact sidebar variant.
// - The full-color JPG is used on white (login). The light PNG is used in
//   the dark sidebar so it stays legible regardless of theme.
export default function AlamutLogo({ className, small = false, variant = "auto" }: Props) {
  const src =
    variant === "dark"
      ? "/alamut-logo.jpg"
      : variant === "light"
        ? "/alamut-logo-light.png"
        : small
          ? "/alamut-logo-light.png"
          : "/alamut-logo.jpg";

  return (
    <img
      src={src}
      alt="Alamut"
      className={cn(small ? "h-8 w-auto" : "h-28 w-auto", "select-none", className)}
    />
  );
}
