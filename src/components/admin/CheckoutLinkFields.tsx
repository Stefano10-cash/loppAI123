import { AdminField, adminInputClass } from '@/components/admin/adminUi';

interface CheckoutLinkFieldsProps {
  url: string;
  isActive: boolean;
  onUrlChange: (value: string) => void;
  onActiveChange: (value: boolean) => void;
}

export function CheckoutLinkFields({ url, isActive, onUrlChange, onActiveChange }: CheckoutLinkFieldsProps) {
  return (
    <div className="space-y-5">
      <AdminField label="Link de checkout">
        <input
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://..."
          className={adminInputClass}
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Os clientes são enviados para este link quando escolhem o plano. Guardar um novo link substitui o anterior.
        </p>
      </AdminField>
      <AdminField label="Estado do checkout">
        <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => onActiveChange(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600"
          />
          Checkout ativo
        </label>
      </AdminField>
    </div>
  );
}
