import { createContext, useContext } from 'react';
import type { RenderedRect } from '@/lib/map-coordinates';

export type ImageRectReader = () => RenderedRect | null;

export const MapImageRectContext = createContext<ImageRectReader | null>(null);

/** Reads the map image bounds without exposing the viewport library to peg components. */
export function useMapImageRect(): ImageRectReader {
  const reader = useContext(MapImageRectContext);
  if (reader === null) {
    throw new Error('Map coordinates are only available inside a MapViewport.');
  }

  return reader;
}
