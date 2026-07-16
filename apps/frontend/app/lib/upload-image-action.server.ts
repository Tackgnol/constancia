import { uploadImage } from '@constancia/api-client/endpoints/uploads/uploads';
import type { UploadImage201Data } from '@constancia/api-client/model';
import { assertApiOk, getApiErrorMessage } from '@/lib/api-errors';
import { buildServerApiOptions } from '@/lib/api-proxy.server';

function isFileUpload(value: FormDataEntryValue | null): value is File {
  return typeof File !== 'undefined' && value instanceof File && value.size > 0;
}

export async function handleUploadImageAction(
  request: Request,
  formData: FormData,
): Promise<Response> {
  try {
    const file = formData.get('file');
    const caption = formData.get('caption');
    if (!isFileUpload(file)) {
      return Response.json(
        { status: 'error', message: 'Choose an image file before uploading.' },
        { status: 400 },
      );
    }

    const response = await uploadImage(
      {
        file,
        ...(typeof caption === 'string' && caption.length > 0 ? { caption } : {}),
      },
      buildServerApiOptions(request),
    );
    assertApiOk(
      response,
      "We couldn't upload this image. Check the file and your connection, then try again.",
    );
    return Response.json({
      status: 'success',
      data: response.data satisfies UploadImage201Data,
    });
  } catch (caught) {
    return Response.json(
      {
        status: 'error',
        message: getApiErrorMessage(
          caught,
          "We couldn't upload this image. Check the file and your connection, then try again.",
        ),
      },
      { status: 500 },
    );
  }
}
