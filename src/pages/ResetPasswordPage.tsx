import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  Lock, Eye, EyeOff, CheckCircle2, AlertCircle, KeyRound,
  ArrowLeft, RefreshCw, Sparkles,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/Loading';

type ResetState = 'loading' | 'form' | 'success' | 'error' | 'expired';

export function ResetPasswordPage({ onBackToLogin }: { onBackToLogin: () => void }) {
  const { user } = useAuth();
  const [state, setState] = useState<ResetState>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendSent, setResendSent] = useState(false);

  // Wait for Supabase to process the recovery token from the URL
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const checkRecovery = async () => {
      // Supabase detects the access_token / refresh_token / type=recovery in the URL
      // and fires onAuthStateChange with event 'PASSWORD_RECOVERY'.
      // We give it a short window to resolve.
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // A recovery session exists — show the reset form
        setState('form');
      } else {
        // No session from URL — the link may be invalid or expired
        timeoutId = setTimeout(() => {
          setState((prev) => (prev === 'loading' ? 'expired' : prev));
        }, 1500);
      }
    };

    checkRecovery();
    return () => clearTimeout(timeoutId);
  }, []);

  function validatePassword(pw: string): string | null {
    if (pw.length < 6) return 'A palavra-passe deve ter pelo menos 6 caracteres.';
    if (!/[a-zA-Z]/.test(pw)) return 'A palavra-passe deve conter pelo menos uma letra.';
    if (!/[0-9]/.test(pw)) return 'A palavra-passe deve conter pelo menos um número.';
    return null;
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const pwError = validatePassword(password);
    if (pwError) { setError(pwError); return; }

    if (password !== confirmPassword) {
      setError('As palavras-passe não coincidem.');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      const msg = updateError.message;
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('token')) {
        setState('expired');
      } else {
        setError(translateError(msg));
      }
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setState('success');
  }

  async function handleResendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!resendEmail.trim()) return;
    setResending(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      resendEmail.trim(),
      { redirectTo: window.location.origin },
    );

    setResending(false);
    if (resetError) {
      setError(translateError(resetError.message));
      return;
    }
    setResendSent(true);
  }

  function translateError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes('invalid login')) return 'Credenciais inválidas. Verifica o teu email e palavra-passe.';
    if (lower.includes('user not found') || lower.includes('user_not_found')) return 'Não encontramos uma conta com esse email.';
    if (lower.includes('rate limit') || lower.includes('over_email_send_rate')) return 'Aguarda alguns minutos antes de pedir outro link.';
    if (lower.includes('expired')) return 'O link de recuperação expirou. Solicita um novo abaixo.';
    if (lower.includes('for password')) return 'A palavra-passe não cumpre os requisitos de segurança.';
    return msg;
  }

  // Branding header (shared)
  const BrandHeader = () => (
    <div className="mb-8 flex items-center gap-2.5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
        <Sparkles className="h-6 w-6 text-white" />
      </div>
      <span className="text-xl font-bold text-slate-900 dark:text-white">LoppAI</span>
    </div>
  );

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="w-full max-w-sm">
          <BrandHeader />
          <div className="flex flex-col items-center gap-4 py-12">
            <LoadingSpinner size={32} />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              A verificar o link de recuperação...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="w-full max-w-sm">
          <BrandHeader />

          <div className="flex flex-col items-center gap-3 rounded-xl bg-amber-50 p-6 text-center dark:bg-amber-500/10">
            <AlertCircle className="h-10 w-10 text-amber-600 dark:text-amber-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Link expirado ou inválido</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Este link de recuperação já não é válido. Os links expiram por segurança.
              Solicita um novo link abaixo.
            </p>
          </div>

          {resendSent ? (
            <div className="mt-6 space-y-4">
              <div className="flex flex-col items-center gap-3 rounded-xl bg-green-50 p-6 text-center dark:bg-green-500/10">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Novo link enviado! Verifica o teu email.
                </p>
              </div>
              <button onClick={onBackToLogin} className="btn-secondary w-full">
                <ArrowLeft className="h-4 w-4" /> Voltar ao login
              </button>
            </div>
          ) : (
            <form onSubmit={handleResendLink} className="mt-6 space-y-4">
              <div>
                <label className="label">Email da conta</label>
                <input
                  type="email"
                  required
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="input"
                  placeholder="email@exemplo.com"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in dark:bg-red-500/10 dark:text-red-400">
                  {error}
                </div>
              )}

              <button type="submit" disabled={resending} className="btn-primary w-full">
                {resending ? <LoadingSpinner size={18} className="text-white" /> : (
                  <><RefreshCw className="h-4 w-4" /> Solicitar novo link</>
                )}
              </button>

              <button
                type="button"
                onClick={onBackToLogin}
                className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar ao login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="w-full max-w-sm">
          <BrandHeader />

          <div className="flex flex-col items-center gap-3 rounded-xl bg-green-50 p-6 text-center dark:bg-green-500/10">
            <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Palavra-passe atualizada!
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              A tua palavra-passe foi alterada com sucesso. Já podes entrar na tua conta
              com a nova palavra-passe.
            </p>
          </div>

          <button onClick={onBackToLogin} className="btn-primary mt-6 w-full">
            <KeyRound className="h-4 w-4" /> Ir para o login
          </button>
        </div>
      </div>
    );
  }

  // state === 'form'
  const pwError = validatePassword(password);
  const passwordsMatch = password === confirmPassword;
  const canSubmit = password.length > 0 && confirmPassword.length > 0 && !pwError && passwordsMatch && !submitting;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <BrandHeader />

        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Nova palavra-passe</h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          Define uma nova palavra-passe para a tua conta.
        </p>

        <form onSubmit={handleUpdatePassword} className="mt-8 space-y-4">
          {/* Password */}
          <div>
            <label className="label">Nova palavra-passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pl-10 pr-10"
                placeholder="••••••••"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password && pwError && (
              <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{pwError}</p>
            )}
            {password && !pwError && (
              <p className="mt-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                Palavra-passe válida
              </p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="label">Confirmar palavra-passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input pl-10 pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                As palavras-passe não coincidem.
              </p>
            )}
            {confirmPassword && passwordsMatch && (
              <p className="mt-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                As palavras-passe coincidem
              </p>
            )}
          </div>

          {/* Password requirements */}
          <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Requisitos:</p>
            <ul className="space-y-1 text-xs">
              <li className={`flex items-center gap-1.5 ${password.length >= 6 ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                <span className={password.length >= 6 ? 'text-green-600' : 'text-slate-300'}>●</span>
                Pelo menos 6 caracteres
              </li>
              <li className={`flex items-center gap-1.5 ${/[a-zA-Z]/.test(password) ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                <span className={/[a-zA-Z]/.test(password) ? 'text-green-600' : 'text-slate-300'}>●</span>
                Pelo menos uma letra
              </li>
              <li className={`flex items-center gap-1.5 ${/[0-9]/.test(password) ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                <span className={/[0-9]/.test(password) ? 'text-green-600' : 'text-slate-300'}>●</span>
                Pelo menos um número
              </li>
            </ul>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in dark:bg-red-500/10 dark:text-red-400">
              {error}
            </div>
          )}

          <button type="submit" disabled={!canSubmit} className="btn-primary w-full">
            {submitting ? <LoadingSpinner size={18} className="text-white" /> : (
              <><KeyRound className="h-4 w-4" /> Definir nova palavra-passe</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
