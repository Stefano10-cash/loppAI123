import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { LoadingSpinner } from '@/components/ui/Loading';
import { formatDate } from '@/lib/utils';
import type { AgeVerification } from '@/types';
import {
  ShieldCheck, Upload, FileText, Loader2, CheckCircle2, XCircle,
  Clock, Calendar, MapPin, Globe, Hash, User, CreditCard, AlertTriangle,
} from 'lucide-react';

const ID_TYPES = [
  { id: 'bilhete_identidade', label: 'Bilhete de Identidade' },
  { id: 'passaporte', label: 'Passaporte' },
  { id: 'carta_conducao', label: 'Carta de Condução' },
  { id: 'residencia', label: 'Cartão de Residência' },
] as const;

export function AgeVerificationPage() {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [verification, setVerification] = useState<AgeVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<'front' | 'back' | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    date_of_birth: '',
    country: 'Angola',
    location: '',
    postal_code: '',
    id_type: 'bilhete_identidade' as AgeVerification['id_type'],
    id_card_number: '',
    id_card_front_url: '',
    id_card_back_url: '',
  });

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('age_verifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setVerification((data as AgeVerification | null) ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  function calculateAge(birthDate: string): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  async function uploadIdCard(side: 'front' | 'back', file: File) {
    if (!user) return;
    setUploading(side);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/kyc/${side}-${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('product-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('product-files')
        .getPublicUrl(fileName);

      setForm((prev) => ({
        ...prev,
        [side === 'front' ? 'id_card_front_url' : 'id_card_back_url']: urlData.publicUrl,
      }));

      await addNotification({
        title: 'Documento carregado',
        message: `${side === 'front' ? 'Frente' : 'Verso'} do documento carregado com sucesso.`,
        type: 'success',
      });
    } catch (err) {
      await addNotification({
        title: 'Erro ao carregar',
        message: 'Não foi possível carregar o documento. Tenta novamente.',
        type: 'error',
      });
    }
    setUploading(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const age = calculateAge(form.date_of_birth);
    if (age < 18) {
      await addNotification({
        title: 'Idade insuficiente',
        message: 'Precisas de ter pelo menos 18 anos para levantar dinheiro.',
        type: 'error',
      });
      return;
    }

    if (!form.id_card_front_url) {
      await addNotification({
        title: 'Documento em falta',
        message: 'Carrega a frente do teu documento de identificação.',
        type: 'error',
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('age_verifications').insert({
      user_id: user.id,
      full_name: form.full_name,
      date_of_birth: form.date_of_birth,
      age,
      country: form.country,
      location: form.location,
      postal_code: form.postal_code || null,
      id_card_front_url: form.id_card_front_url,
      id_card_back_url: form.id_card_back_url || null,
      id_card_number: form.id_card_number || null,
      id_type: form.id_type,
      status: 'pending',
    });

    setSubmitting(false);
    if (error) {
      await addNotification({
        title: 'Erro na submissão',
        message: 'Não foi possível submeter a verificação. Tenta novamente.',
        type: 'error',
      });
      return;
    }

    await addNotification({
      title: 'Verificação submetida',
      message: 'A tua verificação de idade foi submetida e está a ser analisada.',
      type: 'success',
    });
    load();
  }

  if (loading) {
    return <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>;
  }

  const statusApproved = verification?.status === 'approved';
  const statusPending = verification?.status === 'pending';
  const statusRejected = verification?.status === 'rejected';

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-900 p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Verificação de Idade (KYC)</h2>
            <p className="mt-0.5 text-sm text-slate-300">
              Obrigatória para levantar dinheiro. Precisas de ter 18 anos ou mais.
            </p>
          </div>
        </div>
      </div>

      {/* Status card */}
      {verification && (
        <div className={`rounded-2xl border p-5 ${
          statusApproved
            ? 'border-green-200 bg-green-50/50 dark:border-green-500/30 dark:bg-green-500/5'
            : statusPending
              ? 'border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/5'
              : 'border-red-200 bg-red-50/50 dark:border-red-500/30 dark:bg-red-500/5'
        }`}>
          <div className="flex items-start gap-3">
            {statusApproved ? (
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-600 dark:text-green-400" />
            ) : statusPending ? (
              <Clock className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
            ) : (
              <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-600 dark:text-red-400" />
            )}
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {statusApproved ? 'Verificação aprovada' : statusPending ? 'Verificação em análise' : 'Verificação rejeitada'}
              </p>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                {statusApproved
                  ? 'A tua identidade foi verificada. Já podes levantar dinheiro.'
                  : statusPending
                    ? 'A tua verificação está a ser analisada. Receberás uma notificação quando for concluída.'
                    : `A tua verificação foi rejeitada: ${verification.rejection_reason || 'Documento inválido ou ilegível.'}`}
              </p>
              <p className="mt-1 text-xs text-slate-400">Submetido em {formatDate(verification.created_at)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      {(!verification || statusRejected) && (
        <form onSubmit={handleSubmit} className="card space-y-5 p-6">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Dados pessoais</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Preenche com os teus dados reais tal como constam no documento.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Nome completo *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="input pl-10"
                  placeholder="Nome completo"
                />
              </div>
            </div>
            <div>
              <label className="label">Data de nascimento *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                  className="input pl-10"
                />
              </div>
              {form.date_of_birth && calculateAge(form.date_of_birth) < 18 && (
                <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                  Precisas de ter pelo menos 18 anos.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">País *</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="input pl-10"
                  placeholder="Angola"
                />
              </div>
            </div>
            <div>
              <label className="label">Localização *</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="input pl-10"
                  placeholder="Luanda, Talatona..."
                />
              </div>
            </div>
            <div>
              <label className="label">Código postal</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={form.postal_code}
                  onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                  className="input pl-10"
                  placeholder="0000-000"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Tipo de documento *</label>
              <select
                value={form.id_type}
                onChange={(e) => setForm({ ...form, id_type: e.target.value as AgeVerification['id_type'] })}
                className="input"
              >
                {ID_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Número do documento</label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={form.id_card_number}
                  onChange={(e) => setForm({ ...form, id_card_number: e.target.value })}
                  className="input pl-10"
                  placeholder="Número do BI/Passaporte"
                />
              </div>
            </div>
          </div>

          {/* Document uploads */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30">
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Carregar documento de identificação *
            </label>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Carrega a frente e o verso do teu documento. A imagem tem de ser legível.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-blue-400 dark:hover:bg-blue-500/10">
                  {uploading === 'front' ? (
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  ) : form.id_card_front_url ? (
                    <div className="flex flex-col items-center gap-1">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <span className="text-xs font-medium text-green-600">Frente carregada</span>
                    </div>
                  ) : (
                    <>
                      <FileText className="h-8 w-8 text-slate-400" />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Frente do documento</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadIdCard('front', f);
                    }}
                    disabled={uploading !== null}
                  />
                </label>
              </div>
              <div>
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-blue-400 dark:hover:bg-blue-500/10">
                  {uploading === 'back' ? (
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  ) : form.id_card_back_url ? (
                    <div className="flex flex-col items-center gap-1">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <span className="text-xs font-medium text-green-600">Verso carregado</span>
                    </div>
                  ) : (
                    <>
                      <FileText className="h-8 w-8 text-slate-400" />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Verso do documento (opcional)</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadIdCard('back', f);
                    }}
                    disabled={uploading !== null}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 p-4 dark:bg-amber-500/10">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Os teus dados são confidenciais e usados apenas para verificação de identidade.
              A falsificação de documentos é crime e resulta em encerramento imediato da conta.
            </p>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? <LoadingSpinner size={18} className="text-white" /> : <><ShieldCheck className="h-4 w-4" /> Submeter verificação</>}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
