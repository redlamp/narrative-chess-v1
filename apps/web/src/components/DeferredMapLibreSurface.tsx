import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ReactNode
} from "react";
import { Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type DeferredMapLibreSurfaceProps = {
  children: ReactNode;
  title: string;
  description: string;
  loadingLabel?: string;
  autoLoad?: boolean;
};

function MapLibreLoadingState({ text }: { text: string }) {
  return (
    <div className="map-lazy-placeholder" role="status">
      <MapIcon />
      <span>{text}</span>
    </div>
  );
}

export function DeferredMapLibreSurface({
  children,
  title,
  description,
  loadingLabel = "Loading map...",
  autoLoad = true
}: DeferredMapLibreSurfaceProps) {
  const [shouldLoadMap, setShouldLoadMap] = useState(false);
  const loadMap = useCallback(() => setShouldLoadMap(true), []);

  useEffect(() => {
    if (!autoLoad || shouldLoadMap || typeof window === "undefined") {
      return;
    }

    const windowWithIdle = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (windowWithIdle.requestIdleCallback) {
      const idleHandle = windowWithIdle.requestIdleCallback(loadMap, { timeout: 2500 });
      return () => windowWithIdle.cancelIdleCallback?.(idleHandle);
    }

    const timeoutHandle = window.setTimeout(loadMap, 1200);
    return () => window.clearTimeout(timeoutHandle);
  }, [autoLoad, loadMap, shouldLoadMap]);

  if (shouldLoadMap) {
    return (
      <Suspense fallback={<MapLibreLoadingState text={loadingLabel} />}>
        {children}
      </Suspense>
    );
  }

  return (
    <div className="map-lazy-placeholder">
      <MapIcon />
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={loadMap}>
        <MapIcon />
        Load map
      </Button>
    </div>
  );
}
