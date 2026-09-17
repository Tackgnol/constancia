import { PassThrough } from 'node:stream';

import { createReadableStreamFromReadable } from '@react-router/node';
import type { EntryContext } from 'react-router';
import { ServerRouter } from 'react-router';
import { renderToPipeableStream } from 'react-dom/server';
import * as Sentry from '@sentry/react-router';

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  return new Promise<Response>((resolve, reject) => {
    let shellRendered = false;

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        onShellReady() {
          shellRendered = true;
          responseHeaders.set('Content-Type', 'text/html');

          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          Sentry.captureException(error);
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          Sentry.captureException(error);

          if (shellRendered) {
            console.error(error);
          }
        },
      },
    );

    setTimeout(abort, 10_000);
  });
}
