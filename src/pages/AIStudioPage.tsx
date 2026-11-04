import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner, EmptyState } from '@/components/ui/Loading';
import type { PageId } from '@/config/navigation';
import {
  Wand2, ImageIcon, Video, BookMarked, Sparkles, Lock,
  Download, RefreshCw, Check, Crown, Zap, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ToolId = 'images' | 'videos' | 'covers' | 'ebooks';
type PlanId = 'free' | 'starter' | 'pro' | 'business' | 'premium';

interface ToolDef {
  id: ToolId;
  label: string;
  icon: typeof Wand2;
  description: string;
  minPlan: PlanId;
  badge?: string;
}

const TOOLS: ToolDef[] = [
  {
    id: 'images',
    label: 'Gerar Imagens',
    icon: ImageIcon,
    description: 'Cria imagens originais com IA a partir de descrições textuais. Ideal para capas de produtos, banners e redes sociais.',
    minPlan: 'free',
    badge: '3 por mês',
  },
  {
    id: 'videos',
    label: 'Gerar Vídeos',
    icon: Video,
    description: 'Produz vídeos curtos promocionais com IA. Anima logotipos, cria teasers e content para anúncios.',
    minPlan: 'pro',
    badge: 'Pro',
  },
  {
    id: 'covers',
    label: 'Criar Capas',
    icon: BookMarked,
    description: 'Gera capas profissionais para e-books, produtos digitais e lojas. Escolhe estilos, cores e tipografia.',
    minPlan: 'pro',
    badge: 'Pro',
  },
  {
    id: 'ebooks',
    label: 'Criar E-books',
    icon: Sparkles,
    description: 'Escreve e-books completos com IA — estrutura de capítulos, conteúdo, introdução e conclusão incluídos.',
    minPlan: 'premium',
    badge: 'Premium',
  },
];

const PLAN_LABELS: Record<PlanId, { label: string; icon: typeof Crown; color: string }> = {
  free: { label: 'Free', icon: Sparkles, color: 'text-slate-500' },
  starter: { label: 'Starter', icon: Sparkles, color: 'text-slate-600' },
  pro: { label: 'Pro', icon: Zap, color: 'text-blue-600' },
  business: { label: 'Business', icon: Zap, color: 'text-blue-700' },
  premium: { label: 'Premium', icon: Crown, color: 'text-amber-600' },
};

const IMAGE_QUOTA: Record<PlanId, string> = {
  free: '3 gerações por mês',
  starter: '10 gerações por mês',
  pro: '50 gerações por mês',
  business: '200 gerações por mês',
  premium: 'ilimitado',
};

const PLAN_ORDER: string[] = ['free', 'starter', 'pro', 'business', 'premium'];

function canAccess(userPlan: string, requiredPlan: PlanId): boolean {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(requiredPlan);
}

const SAMPLE_IMAGES = [
  'https://images.pexels.com/photos/33501891/pexels-photo-33501891.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  'https://images.pexels.com/photos/33516646/pexels-photo-33516646.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  'https://images.pexels.com/photos/31023729/pexels-photo-31023729.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  'https://images.pexels.com/photos/6560355/pexels-photo-6560355.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
];

const SAMPLE_COVERS = [
  'https://images.pexels.com/photos/8534033/pexels-photo-8534033.jpeg?auto=compress&cs=tinysrgb&h=500&w=380',
  'https://images.pexels.com/photos/6596188/pexels-photo-6596188.jpeg?auto=compress&cs=tinysrgb&h=500&w=380',
  'https://images.pexels.com/photos/8532625/pexels-photo-8532625.jpeg?auto=compress&cs=tinysrgb&h=500&w=380',
];

const IMAGE_STYLES = [
  'Realista', 'Digital Art', 'Aquarela', '3D Render', 'Minimalista', 'Vintage',
];

const VIDEO_DURATIONS = ['5 segundos', '10 segundos', '15 segundos', '30 segundos'];

interface GeneratedItem {
  id: string;
  type: ToolId;
  prompt: string;
  url: string;
  createdAt: string;
}

export function AIStudioPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const { profile } = useAuth();
  const [activeTool, setActiveTool] = useState<ToolId>('images');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('Realista');
  const [duration, setDuration] = useState('10 segundos');
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedItem[]>([]);
  const [error, setError] = useState('');

  const userPlan = profile?.plan ?? 'free';
  const planInfo = PLAN_LABELS[userPlan as PlanId] ?? PLAN_LABELS.free;
  const tool = TOOLS.find((t) => t.id === activeTool)!;
  const hasAccess = canAccess(userPlan, tool.minPlan);

  function selectTool(id: ToolId) {
    setActiveTool(id);
    setPrompt('');
    setError('');
    setResults([]);
  }

  async function generate() {
    if (!prompt.trim()) {
      setError('Escreve uma descrição para gerar o conteúdo.');
      return;
    }
    if (!hasAccess) return;

    setError('');
    setGenerating(true);

    await new Promise((r) => setTimeout(r, 1800 + Math.random() * 1200));

    let url = '';
    if (activeTool === 'images') {
      url = SAMPLE_IMAGES[Math.floor(Math.random() * SAMPLE_IMAGES.length)];
    } else if (activeTool === 'covers') {
      url = SAMPLE_COVERS[Math.floor(Math.random() * SAMPLE_COVERS.length)];
    } else if (activeTool === 'videos') {
      url = SAMPLE_IMAGES[Math.floor(Math.random() * SAMPLE_IMAGES.length)];
    } else {
      url = SAMPLE_COVERS[Math.floor(Math.random() * SAMPLE_COVERS.length)];
    }

    const item: GeneratedItem = {
      id: crypto.randomUUID(),
      type: activeTool,
      prompt: prompt.trim(),
      url,
      createdAt: new Date().toISOString(),
    };

    setResults((prev) => [item, ...prev]);
    setGenerating(false);
  }

  const requiredPlanInfo = PLAN_LABELS[tool.minPlan];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
          <Wand2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Estúdio IA
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Cria imagens, vídeos, capas e e-books com inteligência artificial. Algumas ferramentas requerem assinatura.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const accessible = canAccess(userPlan, t.minPlan);
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => selectTool(t.id)}
              className={cn(
                'card relative p-5 text-left transition-all',
                isActive && 'border-blue-500 ring-1 ring-blue-500/20',
                !accessible && 'opacity-60',
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  isActive ? 'bg-blue-600' : 'bg-slate-100 dark:bg-slate-800',
                )}>
                  <Icon className={cn('h-5 w-5', isActive ? 'text-white' : 'text-slate-600 dark:text-slate-400')} />
                </div>
                {t.badge && (
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                    t.minPlan === 'free'
                      ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                      : t.minPlan === 'pro'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
                  )}>
                    {t.badge}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.label}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.description}</p>
              {!accessible && (
                <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <Lock className="h-3.5 w-3.5" />
                  Requer plano {requiredPlanInfo.label}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <tool.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{tool.label}</h3>
          </div>
        </div>

        {!hasAccess ? (
          <div className="p-8">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20">
                <Lock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Esta ferramenta requer o plano {requiredPlanInfo.label}
              </h4>
              <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                O teu plano atual ({planInfo.label}) não inclui esta funcionalidade.
                Faz upgrade para desbloquear {tool.label} e todas as outras ferramentas premium do Estúdio IA.
              </p>
              <button
                onClick={() => onNavigate('plans')}
                className="btn-primary mt-5"
              >
                <Crown className="h-4 w-4" />
                Ver planos
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label className="label">
                  {activeTool === 'images' && 'Descreve a imagem que queres criar'}
                  {activeTool === 'videos' && 'Descreve o vídeo que queres criar'}
                  {activeTool === 'covers' && 'Descreve a capa que queres criar'}
                  {activeTool === 'ebooks' && 'Descreve o tema do e-book que queres escrever'}
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    activeTool === 'images'
                      ? 'Ex: Uma paisagem montanhosa ao pôr do sol com tons quentes, estilo fotográfico'
                      : activeTool === 'videos'
                        ? 'Ex: Vídeo promocional de um produto cosmético com transições suaves e música ambiente'
                        : activeTool === 'covers'
                          ? 'Ex: Capa para e-book sobre marketing digital, cores azul e branco, moderno'
                          : 'Ex: E-book completo sobre estratégias de vendas online para iniciantes'
                  }
                  rows={3}
                  className="input resize-none"
                />
              </div>

              {activeTool === 'images' && (
                <div>
                  <label className="label">Estilo</label>
                  <div className="flex flex-wrap gap-2">
                    {IMAGE_STYLES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setStyle(s)}
                        className={cn(
                          'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                          style === s
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-400'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTool === 'videos' && (
                <div>
                  <label className="label">Duração</label>
                  <div className="flex flex-wrap gap-2">
                    {VIDEO_DURATIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={cn(
                          'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                          duration === d
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-400'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800',
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTool === 'ebooks' && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="label">Idioma</label>
                    <select className="input" defaultValue="pt">
                      <option value="pt">Português</option>
                      <option value="en">Inglês</option>
                      <option value="es">Espanhol</option>
                      <option value="fr">Francês</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Capítulos</label>
                    <select className="input" defaultValue="5">
                      <option value="3">3 capítulos</option>
                      <option value="5">5 capítulos</option>
                      <option value="7">7 capítulos</option>
                      <option value="10">10 capítulos</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Tom</label>
                    <select className="input" defaultValue="professional">
                      <option value="professional">Profissional</option>
                      <option value="casual">Casual</option>
                      <option value="academic">Académico</option>
                      <option value="inspirational">Inspiracional</option>
                    </select>
                  </div>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={generate}
                  disabled={generating || !prompt.trim()}
                  className="btn-primary"
                >
                  {generating ? (
                    <><LoadingSpinner size={18} className="text-white" /> A gerar...</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Gerar com IA</>
                  )}
                </button>
                {results.length > 0 && (
                  <button
                    onClick={() => setResults([])}
                    className="btn-secondary"
                  >
                    <X className="h-4 w-4" /> Limpar
                  </button>
                )}
                {activeTool === 'images' && (
                  <span className="text-xs text-slate-400">
                    Plano {planInfo.label}: {IMAGE_QUOTA[userPlan as PlanId] ?? IMAGE_QUOTA.free}
                  </span>
                )}
              </div>
            </div>

            {generating && (
              <div className="mt-6">
                <div className="flex items-center gap-3 rounded-lg bg-blue-50 p-4 dark:bg-blue-500/10">
                  <RefreshCw className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-300">A gerar conteúdo...</p>
                    <p className="text-xs text-blue-700 dark:text-blue-400/80">A IA está a processar o teu pedido. Isto pode demorar alguns segundos.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="aspect-video animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
                  ))}
                </div>
              </div>
            )}

            {!generating && results.length === 0 && (
              <div className="mt-6">
                <EmptyState
                  icon={Sparkles}
                  title="Pronto para criar"
                  description="Escreve uma descrição acima e clica em Gerar com IA para ver os resultados aqui."
                />
              </div>
            )}

            {!generating && results.length > 0 && (
              <div className="mt-6 space-y-4">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {results.map((item) => (
                    <div key={item.id} className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className={cn(
                        'relative',
                        activeTool === 'covers' || activeTool === 'ebooks' ? 'aspect-[3/4]' : 'aspect-video',
                      )}>
                        <img src={item.url} alt={item.prompt} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 opacity-0 transition-all group-hover:bg-slate-900/40 group-hover:opacity-100">
                          <div className="flex gap-2">
                            <button className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-slate-700 transition-colors hover:bg-white">
                              <Download className="h-4 w-4" />
                            </button>
                            <button className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-slate-700 transition-colors hover:bg-white">
                              <Check className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{item.prompt}</p>
                        <div className="mt-2 flex items-center gap-1.5">
                          {activeTool === 'images' && <ImageIcon className="h-3 w-3 text-slate-400" />}
                          {activeTool === 'videos' && <Video className="h-3 w-3 text-slate-400" />}
                          {activeTool === 'covers' && <BookMarked className="h-3 w-3 text-slate-400" />}
                          {activeTool === 'ebooks' && <Sparkles className="h-3 w-3 text-slate-400" />}
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            {tool.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-start gap-2.5">
          <Crown className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Desbloqueia todo o potencial do Estúdio IA</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              O plano Free permite gerar 3 imagens por mês. O plano Pro desbloqueia vídeos e capas.
              O plano Premium inclui criação completa de e-books com IA.
            </p>
            <button
              onClick={() => onNavigate('plans')}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Comparar planos <Crown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
