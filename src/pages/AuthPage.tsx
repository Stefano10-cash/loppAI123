import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '@/components/ui/Loading';
import { supabase } from '@/lib/supabase';
import { Sparkles, Mail, Lock, User as UserIcon, ArrowRight, Phone, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';

type AuthMode = 'signin' | 'signup' | 'forgot';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Login supports phone or email. Supabase auth uses email internally.
  // If the user enters a phone, we use a synthetic email: phone@loppai.app
  function resolveLoginIdentifier(input: string): { email: string; isPhone: boolean } {
    const trimmed = input.trim();
    // Phone detection: starts with + or contains mostly digits
    const isPhone = /^\+?[\d\s-]+$/.test(trimmed) && /\d/.test(trimmed);
    if (isPhone) {
      const digits = trimmed.replace(/[\s+-]/g, '');
      return { email: `${digits}@loppai.app`, isPhone: true };
    }
    return { email: trimmed, isPhone: false };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'signin') {
      const { email: loginEmail } = resolveLoginIdentifier(phoneOrEmail);
      const { error } = await signIn(loginEmail, password);
      if (error) setError(error);
    } else if (mode === 'signup') {
      if (password.length < 6) {
        setError('A palavra-passe deve ter pelo menos 6 caracteres.');
        setLoading(false);
        return;
      }
      if (!fullName.trim()) {
        setError('Por favor, inscreve o teu nome.');
        setLoading(false);
        return;
      }
      if (!phone.trim()) {
        setError('Por favor, inscreve o teu número de telefone.');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName, phone);
      if (error) setError(error);
    }

    setLoading(false);
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // If user entered a phone, convert to synthetic email
    const { email: resetEmail } = resolveLoginIdentifier(phoneOrEmail);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin,
    });

    if (error) {
      const lower = error.message.toLowerCase();
      if (lower.includes('rate limit') || lower.includes('over_email_send_rate')) {
        setError('Aguarda alguns minutos antes de pedir outro link de recuperação.');
      } else if (lower.includes('user not found') || lower.includes('user_not_found')) {
        setError('Não encontramos uma conta com esse email.');
      } else {
        setError(error.message);
      }
    } else {
      setResetSent(true);
    }
    setLoading(false);
  }

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setError(null);
    setResetSent(false);
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Left side - branding */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 p-12 lg:flex">
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">LoppAI</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold leading-tight text-white">
            Cria e vende os teus produtos digitais com inteligência artificial
          </h1>
          <p className="text-lg text-blue-100">
            Ebooks, cursos, templates e mais. Tudo numa plataforma integrada com lojas online,
            páginas de vendas e campanhas publicitárias.
          </p>
          <div className="space-y-3 pt-4">
            {[
              'Cria ebooks com assistência de IA',
              'Lojas online e páginas de vendas personalizadas',
              'Gestão de pedidos, cupons e campanhas',
              'Estúdio IA para gerar imagens, vídeos e capas',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-blue-50">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-300" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-sm text-blue-200">
          © 2026 LoppAI. Todos os direitos reservados.
        </div>

        {/* Decorative shapes */}
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-slate-700/30 blur-3xl" />
      </div>

      {/* Right side - form */}
      <div className="flex w-full flex-col items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">LoppAI</span>
          </div>

          {mode === 'forgot' ? (
            <>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Recuperar conta</h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                Introduz o teu email ou telefone para receberes um link de recuperação.
              </p>

              {resetSent ? (
                <div className="mt-8 space-y-4">
                  <div className="flex flex-col items-center gap-3 rounded-xl bg-green-50 p-6 text-center dark:bg-green-500/10">
                    <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">
                      Link de recuperação enviado! Verifica o teu email.
                    </p>
                  </div>
                  <button
                    onClick={() => switchMode('signin')}
                    className="btn-secondary w-full"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar ao login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="mt-8 space-y-4">
                  <div>
                    <label className="label">Email ou telefone</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={phoneOrEmail}
                        onChange={(e) => setPhoneOrEmail(e.target.value)}
                        className="input pl-10"
                        placeholder="email@exemplo.com ou +244 900 000 000"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in dark:bg-red-500/10 dark:text-red-400">
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="btn-primary w-full">
                    {loading ? (
                      <LoadingSpinner size={18} className="text-white" />
                    ) : (
                      <>
                        <KeyRound className="h-4 w-4" />
                        Enviar link de recuperação
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar ao login
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {mode === 'signin' ? 'Bem-vindo de volta' : 'Cria a tua conta'}
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                {mode === 'signin'
                  ? 'Entra com o teu telefone ou email para continuar.'
                  : 'Preenche os teus dados para começar a criar e vender.'}
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                {mode === 'signup' && (
                  <>
                    <div>
                      <label className="label">Nome completo</label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="input pl-10"
                          placeholder="O teu nome completo"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="label">Número de telefone</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="input pl-10"
                          placeholder="+244 900 000 000"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="label">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="input pl-10"
                          placeholder="nome@exemplo.com"
                        />
                      </div>
                    </div>
                  </>
                )}

                {mode === 'signin' && (
                  <div>
                    <label className="label">Telefone ou email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={phoneOrEmail}
                        onChange={(e) => setPhoneOrEmail(e.target.value)}
                        className="input pl-10"
                        placeholder="email@exemplo.com ou +244 900 000 000"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="label">Palavra-passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input pl-10"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {mode === 'signin' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400"
                    >
                      Esqueceste a palavra-passe?
                    </button>
                  </div>
                )}

                {error && (
                  <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in dark:bg-red-500/10 dark:text-red-400">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? (
                    <LoadingSpinner size={18} className="text-white" />
                  ) : (
                    <>
                      {mode === 'signin' ? 'Entrar' : 'Criar conta'}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {mode === 'signin' ? 'Ainda não tens conta?' : 'Já tens conta?'}{' '}
                <button
                  onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                  className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  {mode === 'signin' ? 'Regista-te' : 'Entra'}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
