import { z } from 'zod';
import NewProductForm from './NewProductForm';

export const metadata = { title: 'เพิ่มสินค้า — Fit MVP' };

/** ?folder=<id> creates the product in that folder (the server checks it is the caller's). */
export default async function NewProductPage(props: { searchParams: Promise<{ folder?: string | string[] }> }) {
  const { folder } = await props.searchParams;
  const folderId = typeof folder === 'string' && z.uuid().safeParse(folder).success ? folder : null;
  return <NewProductForm folderId={folderId} />;
}
