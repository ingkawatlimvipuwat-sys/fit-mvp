import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <h1 className="text-3xl font-semibold">Fit MVP</h1>
      <p className="mt-3 text-gray-600">หาขนาดที่ใช่สำหรับลูกค้าของคุณ</p>
      <div className="mt-8 flex gap-4">
        <Link href="/login" className="rounded bg-gray-900 px-4 py-2 text-white">เข้าสู่ระบบ</Link>
        <Link href="/signup" className="rounded border border-gray-300 px-4 py-2">สมัครสมาชิก</Link>
      </div>
    </main>
  );
}
