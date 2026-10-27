'use client';
import ModalSheet from './ModalSheet';
import NameForm from './NameForm';

/** NameForm in a dialog: the in-page replacement for window.prompt. */
export default function NameDialog({ title, onCancel, ...form }: {
  title: string; label: string; initial?: string; maxLength: number; submitText: string;
  onSubmit: (name: string) => Promise<string | null>; onCancel: () => void;
}) {
  return (
    <ModalSheet title={title} onClose={onCancel} align="top">
      <NameForm {...form} onCancel={onCancel} />
    </ModalSheet>
  );
}
