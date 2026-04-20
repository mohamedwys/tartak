import { Pipe, PipeTransform } from '@angular/core';

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  resize?: 'cover' | 'contain' | 'fill';
}

/**
 * Rewrites a Supabase Storage public URL to use the image transformation
 * endpoint. Non-Supabase URLs (legacy, external) pass through unchanged so
 * this can be applied everywhere without risk.
 *
 * Supabase endpoint format:
 *   https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
 *   → https://<ref>.supabase.co/storage/v1/render/image/public/<bucket>/<path>?width=…
 */
export function transformImageUrl(
  url: string | null | undefined,
  opts: ImageTransformOptions = {},
): string | null {
  if (!url) return null;

  const match = url.match(/^(https?:\/\/[^/]+)\/storage\/v1\/object\/public\/(.+)$/);
  if (!match) return url;

  const [, origin, path] = match;
  const params = new URLSearchParams();
  if (opts.width)   params.set('width', String(opts.width));
  if (opts.height)  params.set('height', String(opts.height));
  if (opts.quality) params.set('quality', String(opts.quality));
  if (opts.resize)  params.set('resize', opts.resize);

  const qs = params.toString();
  return `${origin}/storage/v1/render/image/public/${path}${qs ? `?${qs}` : ''}`;
}

@Pipe({ name: 'img', pure: true, standalone: true })
export class ImagePipe implements PipeTransform {
  transform(
    value: string | null | undefined,
    width?: number,
    quality: number = 80,
  ): string | null {
    return transformImageUrl(value, { width, quality });
  }
}
