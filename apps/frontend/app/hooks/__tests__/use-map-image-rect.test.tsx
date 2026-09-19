import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MapImageRectContext, useMapImageRect } from '../use-map-image-rect';

function RectProbe() {
  const rect = useMapImageRect()();
  return <span>{rect ? `${rect.width}x${rect.height}` : 'missing'}</span>;
}

describe('useMapImageRect', () => {
  it('returns the reader supplied by the map viewport', () => {
    const markup = renderToStaticMarkup(
      <MapImageRectContext.Provider value={() => ({ left: 0, top: 0, width: 640, height: 480 })}>
        <RectProbe />
      </MapImageRectContext.Provider>,
    );

    expect(markup).toContain('640x480');
  });

  it('rejects use outside a map viewport', () => {
    expect(() => renderToStaticMarkup(<RectProbe />)).toThrow(
      'Map coordinates are only available inside a MapViewport.',
    );
  });
});
