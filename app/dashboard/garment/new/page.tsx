import GarmentForm from '@/app/dashboard/garment/GarmentForm';

export const metadata = { title: 'เพิ่มเสื้อผ้า — Fit MVP' };

export default function NewGarmentPage() {
  return <GarmentForm mode="create" />;
}
