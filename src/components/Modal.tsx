import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useT } from "../i18n";
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="modal-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label={t.common.close}
          onClick={onClose}
        >
          <X aria-hidden="true" size={18} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
