import { uploadImage } from '@constancia/api-client/endpoints/uploads/uploads';
import type { UploadImage201Data } from '@constancia/api-client/model';
import { assertApiOk, getApiErrorMessage } from '@/lib/api-errors';
import { buildServerApiOptions } from '@/lib/api-proxy.server';

const UPLOAD_ERROR =
  "We couldn't upload this image. Check the file and your connection, then try again.";

export type UploadImageResult =
  | { status: 'success'; data: UploadImage201Data }
  | { status: 'error'; message: string; statusCode: number };

function isFileUpload(value: FormDataEntryValue | null): value is File {
  return typeof File !== 'undefined' && value instanceof File && value.size > 0;
}

/**
 * Composable half of the upload action: callers that must chain another API call — attaching a
 * scene map, say — need the asset id without a Response in the way.
 */
export async function uploadImageFromFormData(
  request: Request,
  formData: FormData,
): Promise<UploadImageResult> {
  const file = formData.get('file');
  const caption = formData.get('caption');
  if (!isFileUpload(file)) {
    return {
      status: 'error',
      message: 'Choose an image file before uploading.',
      statusCode: 400,
    };
  }

  try {
    const response = await uploadImage(
      {
        file,
        ...(typeof caption === 'string' && caption.length > 0 ? { caption } : {}),
      },
      buildServerApiOptions(request),
    );
    assertApiOk(response, UPLOAD_ERROR);
    return { status: 'success', data: response.data };
  } catch (caught) {
    return {
      status: 'error',
      message: getApiErrorMessage(caught, UPLOAD_ERROR),
      statusCode: 500,
    };
  }
}

export async function handleUploadImageAction(
  request: Request,
  formData: FormData,
): Promise<Response> {
  const result = await uploadImageFromFormData(request, formData);

  if (result.status === 'error') {
    return Response.json(
      { status: 'error', message: result.message },
      { status: result.statusCode },
    );
  }

  return Response.json({ status: 'success', data: result.data });
}
