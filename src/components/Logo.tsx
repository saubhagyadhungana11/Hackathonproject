import { Shield } from 'lucide-react';

interface LogoProps {
  size?: number;
  className?: string;
  dark?: boolean;
}

export default function Logo({ size = 40, className = '', dark = false }: LogoProps) {
  return (
    <img
      src="/assets/image.png"
      alt="Sahayata"
      width={size}
      height={size}
      className={`rounded-lg object-cover flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
