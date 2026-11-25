import type { Profile } from '../lib/types'

export function initialsOf(name?: string | null, email?: string | null) {
  return (name || email || '?')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function Avatar({ profile, email, className = 'h-9 w-9 text-sm' }: { profile: Profile | null; email?: string | null; className?: string }) {
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="Foto de perfil" className={`${className} shrink-0 rounded-full object-cover`} />
  }
  return (
    <span className={`${className} flex shrink-0 items-center justify-center rounded-full bg-gold font-semibold`}>
      {initialsOf(profile?.full_name, email)}
    </span>
  )
}

// Recorta al centro en cuadrado y achica a 512 px para que las fotos del celular pesen poco.
export async function squareJpeg(file: File, size = 512): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const side = Math.min(bmp.width, bmp.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size)
  bmp.close()
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.85))
}
