import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  small?: boolean;
}

// Lightweight wordmark — used both at login (centered, larger) and in the
// sidebar (compact). No image dependency so the build remains self-contained.
export default function AlamutLogo({ className, small = false }: Props) {
  return (
    <div className={cn("flex flex-col items-center select-none", className)}>
      <div
        className={cn(
          "font-semibold tracking-[0.2em]",
          small ? "text-base" : "text-3xl",
        )}
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        ALAMUT
      </div>
      {!small && (
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-1">
          Compliance
        </div>
      )}
    </div>
  );
}
