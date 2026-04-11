import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SlideOverPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Width class, defaults to w-full max-w-lg */
  widthClass?: string;
}

/**
 * Panze-style slide-over panel that enters from the right edge.
 * Used for create/edit forms across all CRUD pages.
 */
export default function SlideOverPanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  widthClass = 'w-full max-w-lg',
}: SlideOverPanelProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Trap focus inside panel when open
  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus();
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 z-50"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={`fixed inset-y-0 right-0 z-50 ${widthClass} bg-white shadow-2xl flex flex-col outline-none`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#E4E4E7]">
              <div>
                <h2 className="text-lg font-semibold text-[#09090B] tracking-tight">{title}</h2>
                {subtitle && (
                  <p className="text-sm text-[#71717A] mt-0.5">{subtitle}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-[#F4F4F5] text-[#71717A] hover:text-[#09090B] transition-colors"
                aria-label={t('common.close', 'Close')}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
