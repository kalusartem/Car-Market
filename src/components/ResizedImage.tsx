import type { ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
  /** Original image, used if the resized copy fails (e.g. transformations disabled or over quota). */
  fallback: string;
};

export function ResizedImage({ src, fallback, onError, ...rest }: Props) {
  return (
    <img
      {...rest}
      src={src}
      onError={(e) => {
        const img = e.currentTarget;
        if (img.src !== fallback) img.src = fallback;
        onError?.(e);
      }}
    />
  );
}
