import {
  Sun,
  Moon,
  Cloud,
  CloudSun,
  CloudMoon,
  CloudFog,
  CloudRain,
  CloudSnow,
  CloudLightning,
  type LucideProps,
} from 'lucide-react';

const iconMap = {
  sun: Sun,
  moon: Moon,
  cloud: Cloud,
  'sun-cloud': CloudSun,
  'moon-cloud': CloudMoon,
  fog: CloudFog,
  rain: CloudRain,
  snow: CloudSnow,
  thunderstorm: CloudLightning,
};

export default function WeatherIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = iconMap[name as keyof typeof iconMap] ?? Cloud;
  return <Icon {...props} />;
}
