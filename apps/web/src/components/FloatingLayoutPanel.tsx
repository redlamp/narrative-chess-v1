import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";

type FloatingLayoutPanelProps = {
  children: (input: {
    onDragHandlePointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    isDragging: boolean;
  }) => ReactNode;
};

type PanelPosition = {
  left: number;
  top: number;
};

const defaultTopOffset = 172;
const viewportPadding = 16;
const fallbackPanelWidth = 352;
const fallbackPanelHeight = 320;

function getInitialPosition(): PanelPosition {
  if (typeof window === "undefined") {
    return {
      left: 24,
      top: defaultTopOffset
    };
  }

  const panelWidth = Math.min(fallbackPanelWidth, Math.max(window.innerWidth - 32, 240));

  return {
    left: Math.max(viewportPadding, window.innerWidth - panelWidth - 24),
    top: Math.max(viewportPadding, Math.min(defaultTopOffset, window.innerHeight - 180))
  };
}

export function FloatingLayoutPanel({ children }: FloatingLayoutPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [position, setPosition] = useState<PanelPosition>(() => getInitialPosition());
  const [isDragging, setIsDragging] = useState(false);

  const clampPosition = useCallback((nextPosition: PanelPosition) => {
    if (typeof window === "undefined") {
      return nextPosition;
    }

    const panelWidth = panelRef.current?.offsetWidth ?? fallbackPanelWidth;
    const panelHeight = panelRef.current?.offsetHeight ?? fallbackPanelHeight;

    return {
      left: Math.min(
        Math.max(viewportPadding, nextPosition.left),
        Math.max(viewportPadding, window.innerWidth - panelWidth - viewportPadding)
      ),
      top: Math.min(
        Math.max(viewportPadding, nextPosition.top),
        Math.max(viewportPadding, window.innerHeight - panelHeight - viewportPadding)
      )
    };
  }, []);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      setPosition(
        clampPosition({
          left: event.clientX - dragOffsetRef.current.x,
          top: event.clientY - dragOffsetRef.current.y
        })
      );
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [clampPosition, isDragging]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setPosition((current) => clampPosition(current));
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [clampPosition]);

  const handleDragHandlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const panelRect = panelRef.current?.getBoundingClientRect();
    if (!panelRect) {
      return;
    }

    event.preventDefault();
    dragOffsetRef.current = {
      x: event.clientX - panelRect.left,
      y: event.clientY - panelRect.top
    };
    setIsDragging(true);
  };

  return (
    <aside
      ref={panelRef}
      className="workspace-layout-shell__sidebar"
      data-dragging={isDragging ? "true" : "false"}
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
        maxHeight: `calc(100vh - ${Math.max(position.top, viewportPadding)}px - ${viewportPadding}px)`
      }}
    >
      {children({
        onDragHandlePointerDown: handleDragHandlePointerDown,
        isDragging
      })}
    </aside>
  );
}
