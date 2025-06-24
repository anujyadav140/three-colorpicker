// src/utils/cropImage.ts

/**
 * Crop an image given source and cropping rectangle, returning a Blob.
 * @param imageSrc - data URL or remote URL of the image
 * @param pixelCrop - cropping rectangle in pixels { x, y, width, height }
 * @returns Promise resolving to a PNG Blob of the cropped region
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<Blob> {
  // Helper: load image
  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.setAttribute('crossOrigin', 'anonymous') // needed for CORS-safe canvas
      img.onload = () => resolve(img)
      img.onerror = (err) => reject(err)
      img.src = url
    })

  const image = await createImage(imageSrc)

  // Create canvas of the target size
  const canvas = document.createElement('canvas')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')!

  // Draw the cropped portion onto the canvas
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  // Convert to Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas is empty'))
      },
      'image/png',
    )
  })
}
