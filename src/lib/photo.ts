import { decode } from 'base64-arraybuffer';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const MAX_BYTES = 2 * 1024 * 1024;

export async function compressedJpeg(uri: string): Promise<ArrayBuffer> {
  for (const [width, quality] of [[1280, 0.65], [960, 0.5]] as const) {
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width, height: null });
    const rendered = await context.renderAsync();
    const image = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: quality,
      base64: true,
    });
    if (!image.base64) throw new Error('No se pudo preparar la fotografía. Tómala de nuevo.');
    const bytes = decode(image.base64);
    if (bytes.byteLength <= MAX_BYTES) return bytes;
  }
  throw new Error('La fotografía supera 2 MB. Tómala de nuevo.');
}
