// Shrink a phone photo before upload: big enough to read the style, small enough to send quickly.
const MAX_SIDE = 1280;

export async function photoToJpeg(file: File): Promise<{ image: string; mediaType: 'image/jpeg'; preview: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas');
  ctx.fillStyle = '#fff'; // transparent PNGs become white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const preview = canvas.toDataURL('image/jpeg', 0.85);
  return { image: preview.slice(preview.indexOf(',') + 1), mediaType: 'image/jpeg', preview };
}
