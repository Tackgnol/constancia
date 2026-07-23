import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { Button } from '@/components/ui/button';
import {
  normalizePointInRect,
  type NormalizedPoint,
  type RenderedRect,
} from '@/lib/map-coordinates';

type ImageRectReader = () => RenderedRect | null;

const MapImageRectContext = createContext<ImageRectReader | null>(null);

/**
 * Gives descendants the live bounding box of the map image — the one coordinate frame pegs are
 * measured against — without exposing the viewport library or the image element itself.
 */
export function useMapImageRect(): ImageRectReader {
  const reader = useContext(MapImageRectContext);
  if (reader === null) {
    throw new Error('Map coordinates are only available inside a MapViewport.');
  }

  return reader;
}

/**
 * Elements carrying this class never start a viewport pan, so dragging a peg moves the peg rather
 * than the camera. react-zoom-pan-pinch matches these against the event target's class list.
 */
export const NO_PAN_CLASS = 'map-no-pan';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * Wraps the pan/zoom dependency so no third-party type reaches the route projection or the peg
 * components. Coordinates are read off the image element, which is the only coordinate frame.
 */
export function MapViewport({
  imageUrl,
  imageAlt,
  placementActive,
  onPlace,
  children,
}: {
  imageUrl: string;
  imageAlt: string;
  placementActive: boolean;
  onPlace: (point: NormalizedPoint) => void;
  children: ReactNode;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  // react-zoom-pan-pinch drives the transform imperatively and only exposes the render-prop's own
  // `state` at the point it last re-rendered, which isn't every zoom step; `onTransform` fires on
  // every change, so the live readout tracks that instead.
  const [zoomPercent, setZoomPercent] = useState(100);
  const readImageRect = useMemo<ImageRectReader>(
    () => () => imageRef.current?.getBoundingClientRect() ?? null,
    [],
  );

  const placeFromClient = (clientX: number, clientY: number) => {
    const rect = readImageRect();
    if (rect === null) {
      return;
    }

    onPlace(normalizePointInRect(clientX, clientY, rect));
  };

  return (
    <TransformWrapper
      centerOnInit
      doubleClick={{ disabled: true }}
      maxScale={8}
      minScale={0.5}
      onTransform={(_ref, state) => setZoomPercent(Math.round(state.scale * 100))}
      panning={{ excluded: [NO_PAN_CLASS], velocityDisabled: reducedMotion }}
      /*
       * `smooth` multiplies the wheel step by the raw wheel-event deltaY (library quirk: it's
       * meant for tiny per-pixel step values, not a flat per-notch one). With a flat step, a
       * single wheel notch or trackpad burst could jump straight from minScale to maxScale.
       * Linear button steps are a fine trade for wheel zoom that stays where you put it.
       */
      smooth={false}
      velocityAnimation={{ disabled: reducedMotion }}
      wheel={{ step: 0.1 }}
      zoomAnimation={{ disabled: reducedMotion }}
    >
      {({ zoomIn, zoomOut, resetTransform }) => (
        <div className="map-viewport">
          <div className={`map-viewport-controls ${NO_PAN_CLASS}`}>
            <Button
              aria-label="Zoom out"
              className="icon-hit-44"
              onClick={() => zoomOut()}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ZoomOut aria-hidden="true" />
            </Button>
            <span className="map-viewport-zoom-pct" aria-live="polite">
              {zoomPercent}%
            </span>
            <Button
              aria-label="Zoom in"
              className="icon-hit-44"
              onClick={() => zoomIn()}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ZoomIn aria-hidden="true" />
            </Button>
            <span className="map-viewport-controls-divider" />
            <Button
              aria-label="Reset the map view"
              className="icon-hit-44"
              onClick={() => resetTransform()}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <RotateCcw aria-hidden="true" />
            </Button>
          </div>

          <TransformComponent
            contentClass="map-viewport-content"
            wrapperClass="map-viewport-surface"
          >
            <div className={`map-image-frame${placementActive ? ' is-placing' : ''}`}>
              <img alt={imageAlt} className="map-canvas-image" ref={imageRef} src={imageUrl} />
              {/*
                Placement uses a dedicated overlay rather than a click handler on the image, so a
                normal drag still pans and only an armed placement consumes the click.
              */}
              {placementActive ? (
                <button
                  aria-label="Place the selected target on the map"
                  className={`map-placement-surface ${NO_PAN_CLASS}`}
                  onClick={(event) => placeFromClient(event.clientX, event.clientY)}
                  type="button"
                />
              ) : null}
              <MapImageRectContext.Provider value={readImageRect}>
                {children}
              </MapImageRectContext.Provider>
            </div>
          </TransformComponent>
        </div>
      )}
    </TransformWrapper>
  );
}
