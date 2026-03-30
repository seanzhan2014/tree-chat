import { useRef, useState, useEffect } from 'react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (!dialogRef.current) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const rect = dialogRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    const w = rect.width, h = rect.height;
    const onMove = (ev: MouseEvent) => {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - w, ev.clientX - offsetX)),
        y: Math.max(0, Math.min(window.innerHeight - h, ev.clientY - offsetY)),
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const dialogStyle = pos
    ? { position: 'fixed' as const, top: pos.y, left: pos.x, transform: 'none' }
    : { position: 'fixed' as const, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onCancel} />
      <div
        ref={dialogRef}
        className="z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-80"
        style={dialogStyle}
      >
        <h3
          className="font-semibold text-base mb-2 cursor-move select-none"
          onMouseDown={handleDragStart}
          title="Drag to move"
        >
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
