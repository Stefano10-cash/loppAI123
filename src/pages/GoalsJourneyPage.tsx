import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner, EmptyState } from '@/components/ui/Loading';
import type { SellerGoal, GoalPlanet } from '@/types';
import {
  Rocket, Target, Trophy, TrendingUp, Check, Zap, Star,
  Package, DollarSign, Store, Megaphone, Users,
} from 'lucide-react';

interface Planet {
  id: GoalPlanet;
  name: string;
  color: string;
  gradient: string;
  size: number;
  orbit: number;
  defaultTarget: number;
  goalType: 'sales' | 'revenue' | 'products' | 'stores' | 'campaigns' | 'affiliates';
  icon: typeof Package;
  description: string;
}

const PLANETS: Planet[] = [
  { id: 'mercury', name: 'Mercúrio', color: '#94a3b8', gradient: 'from-slate-400 to-slate-600', size: 48, orbit: 80, defaultTarget: 5, goalType: 'sales', icon: Zap, description: 'Primeiras 5 vendas' },
  { id: 'venus', name: 'Vénus', color: '#fbbf24', gradient: 'from-amber-400 to-amber-600', size: 64, orbit: 130, defaultTarget: 25000, goalType: 'revenue', icon: DollarSign, description: 'Arrecadar 25.000 Kz' },
  { id: 'earth', name: 'Terra', color: '#3b82f6', gradient: 'from-blue-400 to-blue-600', size: 72, orbit: 185, defaultTarget: 10, goalType: 'products', icon: Package, description: 'Criar 10 produtos' },
  { id: 'mars', name: 'Marte', color: '#ef4444', gradient: 'from-red-400 to-red-600', size: 56, orbit: 240, defaultTarget: 2, goalType: 'stores', icon: Store, description: 'Abrir 2 lojas' },
  { id: 'jupiter', name: 'Júpiter', color: '#f59e0b', gradient: 'from-orange-400 to-orange-600', size: 120, orbit: 320, defaultTarget: 100, goalType: 'sales', icon: Target, description: '100 vendas totais' },
  { id: 'saturn', name: 'Saturno', color: '#eab308', gradient: 'from-yellow-400 to-yellow-600', size: 104, orbit: 400, defaultTarget: 3, goalType: 'campaigns', icon: Megaphone, description: '3 campanhas ativas' },
  { id: 'uranus', name: 'Úrano', color: '#06b6d4', gradient: 'from-cyan-400 to-cyan-600', size: 80, orbit: 470, defaultTarget: 10, goalType: 'affiliates', icon: Users, description: '10 afiliados' },
  { id: 'neptune', name: 'Neptuno', color: '#8b5cf6', gradient: 'from-violet-400 to-violet-600', size: 76, orbit: 540, defaultTarget: 100000, goalType: 'revenue', icon: Trophy, description: '100.000 Kz em receita' },
];

export function GoalsJourneyPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<SellerGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanet, setSelectedPlanet] = useState<Planet | null>(null);
  const [customTarget, setCustomTarget] = useState(0);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('seller_goals').select('*').eq('user_id', user.id);
    setGoals((data ?? []) as SellerGoal[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  function getGoalForPlanet(planetId: GoalPlanet): SellerGoal | undefined {
    return goals.find((g) => g.planet === planetId);
  }

  async function createOrUpdateGoal() {
    if (!user || !selectedPlanet) return;
    setSaving(true);
    const existing = getGoalForPlanet(selectedPlanet.id);
    const targetValue = customTarget || selectedPlanet.defaultTarget;

    if (existing) {
      await supabase.from('seller_goals').update({ target_value: targetValue }).eq('id', existing.id);
    } else {
      await supabase.from('seller_goals').insert({
        user_id: user.id,
        planet: selectedPlanet.id,
        planet_name: selectedPlanet.name,
        goal_type: selectedPlanet.goalType,
        target_value: targetValue,
        current_value: 0,
        is_completed: false,
      });
    }

    setSaving(false);
    setSelectedPlanet(null);
    setCustomTarget(0);
    load();
  }

  if (loading) {
    return <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>;
  }

  const completedCount = goals.filter((g) => g.is_completed).length;
  const totalProgress = goals.length > 0 ? Math.round((completedCount / PLANETS.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-8 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.2),transparent_60%)]" />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-indigo-300 ring-1 ring-white/10">
            <Rocket className="h-3.5 w-3.5" />
            Jornada Planetária
          </div>
          <h2 className="text-3xl font-extrabold text-white">A tua jornada de vendedor</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
            Conquista cada planeta atingindo as tuas metas de vendas. Cada planeta representa um marco na tua jornada.
          </p>
          <div className="mt-4 inline-flex items-center gap-3 rounded-xl bg-white/5 px-5 py-2.5 ring-1 ring-white/10">
            <Trophy className="h-5 w-5 text-amber-400" />
            <span className="text-sm font-medium text-white">{completedCount} / {PLANETS.length} planetas conquistados</span>
            <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-bold text-indigo-300">{totalProgress}%</span>
          </div>
        </div>
      </div>

      {/* Solar system visualization */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-8 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="relative mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-6 py-8">
          {/* Sun */}
          <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-600 shadow-2xl shadow-orange-500/30">
            <Star className="h-10 w-10 text-white" />
          </div>

          {/* Planets */}
          {PLANETS.map((planet) => {
            const goal = getGoalForPlanet(planet.id);
            const progress = goal ? Math.min(100, Math.round((Number(goal.current_value) / Number(goal.target_value)) * 100)) : 0;
            const isCompleted = goal?.is_completed ?? false;
            const Icon = planet.icon;

            return (
              <button
                key={planet.id}
                onClick={() => {
                  setSelectedPlanet(planet);
                  setCustomTarget(goal?.target_value ? Number(goal.target_value) : planet.defaultTarget);
                }}
                className="group relative flex flex-col items-center gap-2"
              >
                <div
                  className={`relative flex items-center justify-center rounded-full bg-gradient-to-br ${planet.gradient} shadow-lg transition-transform group-hover:scale-110 ${isCompleted ? 'ring-4 ring-green-400/50' : 'ring-2 ring-white/20'}`}
                  style={{ width: planet.size / 2, height: planet.size / 2 }}
                >
                  <Icon className="h-5 w-5 text-white" />
                  {isCompleted && (
                    <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 ring-2 ring-white dark:ring-slate-900">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{planet.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-500">{planet.description}</p>
                  {goal && (
                    <p className={`text-[10px] font-medium ${isCompleted ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {progress}%
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Goals list */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANETS.map((planet) => {
          const goal = getGoalForPlanet(planet.id);
          const progress = goal ? Math.min(100, Math.round((Number(goal.current_value) / Number(goal.target_value)) * 100)) : 0;
          const isCompleted = goal?.is_completed ?? false;
          const Icon = planet.icon;

          return (
            <button
              key={planet.id}
              onClick={() => {
                setSelectedPlanet(planet);
                setCustomTarget(goal?.target_value ? Number(goal.target_value) : planet.defaultTarget);
              }}
              className={`group flex flex-col rounded-xl border p-4 text-left transition-all hover:shadow-md ${
                isCompleted
                  ? 'border-green-300 bg-green-50/50 dark:border-green-500/30 dark:bg-green-500/5'
                  : goal
                    ? 'border-blue-200 bg-blue-50/30 dark:border-blue-500/20 dark:bg-blue-500/5'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900'
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${planet.gradient}`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                {isCompleted ? (
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700 dark:bg-green-500/20 dark:text-green-400">
                    <Check className="h-3 w-3" /> Concluído
                  </span>
                ) : goal ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                    {progress}%
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    Por definir
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{planet.name}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{planet.description}</p>
              {goal && (
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${planet.gradient}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {Number(goal.current_value)} / {Number(goal.target_value)}
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Modal for setting goal */}
      {selectedPlanet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedPlanet(null)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-slide-up dark:bg-slate-900">
            <div className={`bg-gradient-to-br ${selectedPlanet.gradient} px-6 py-5`}>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
                  <selectedPlanet.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedPlanet.name}</h3>
                  <p className="text-sm text-white/80">{selectedPlanet.description}</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Meta</label>
              <input
                type="number"
                value={customTarget}
                onChange={(e) => setCustomTarget(Number(e.target.value))}
                className="input"
                placeholder={`Meta sugerida: ${selectedPlanet.defaultTarget}`}
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Define o valor que queres atingir para conquistar este planeta.
              </p>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setSelectedPlanet(null)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                  Cancelar
                </button>
                <button
                  onClick={createOrUpdateGoal}
                  disabled={saving || customTarget <= 0}
                  className={`flex flex-[2] items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${selectedPlanet.gradient} py-3 text-sm font-bold text-white shadow-lg transition-all active:scale-[0.98]`}
                >
                  {saving ? <LoadingSpinner size={18} className="text-white" /> : <>
                    <Target className="h-4 w-4" />
                    Definir meta
                  </>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
