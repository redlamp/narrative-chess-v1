import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FloatingActionNoticeState = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type FloatingActionNoticeProps = {
  notice: FloatingActionNoticeState | null;
  className?: string;
  notificationTimeMs?: number;
  isPaused?: boolean;
  onDismiss?: () => void;
};

const DEFAULT_NOTIFICATION_TIME_MS = 10_000;
const NOTIFICATION_EXIT_TIME_MS = 160;

export function FloatingActionNotice({
  notice,
  className,
  notificationTimeMs = DEFAULT_NOTIFICATION_TIME_MS,
  isPaused = false,
  onDismiss
}: FloatingActionNoticeProps) {
  const [visibility, setVisibility] = useState<"hidden" | "visible" | "leaving">(
    notice ? "visible" : "hidden"
  );
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!notice) {
      setVisibility("hidden");
      return;
    }

    setVisibility("visible");
  }, [notice]);

  useEffect(() => {
    if (!notice || isPaused || isHovered) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setVisibility("leaving");
    }, notificationTimeMs);

    return () => window.clearTimeout(timeoutId);
  }, [isHovered, isPaused, notice, notificationTimeMs]);

  useEffect(() => {
    if (visibility !== "leaving") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setVisibility("hidden");
      onDismiss?.();
    }, NOTIFICATION_EXIT_TIME_MS);

    return () => window.clearTimeout(timeoutId);
  }, [onDismiss, visibility]);

  if (!notice || visibility === "hidden") {
    return null;
  }

  const handleDismiss = () => {
    setVisibility("leaving");
  };

  return (
    <div
      aria-live="polite"
      role="status"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "floating-action-notice",
        notice.tone === "error"
          ? "floating-action-notice--error"
          : notice.tone === "success"
            ? "floating-action-notice--success"
            : "floating-action-notice--neutral",
        visibility === "leaving" && "floating-action-notice--leaving",
        className
      )}
    >
      <span className="floating-action-notice__text">{notice.text}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="floating-action-notice__close"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
      >
        <X />
      </Button>
    </div>
  );
}
