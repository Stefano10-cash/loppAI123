import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner, EmptyState } from '@/components/ui/Loading';
import type { ChatConversation, ChatMessage } from '@/types';
import type { PageId } from '@/config/navigation';
import { Bot, Send, Plus, MessageSquare, Trash2, Sparkles, Info, Lock } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';

interface AIMockResponse {
  keywords: string[];
  response: string;
}

const aiResponses: AIMockResponse[] = [
  {
    keywords: ['produto', 'criar', 'novo'],
    response: 'Para criar um novo produto, vai à secção "Produtos" e clica em "Novo Produto". Podes escolher entre produto digital, físico ou ebook. Preenche o nome, descrição, preço e define o estado como "Publicado" quando estiver pronto.',
  },
  {
    keywords: ['ebook', 'livro', 'escrever'],
    response: 'Os ebooks no LoppAI permitem criar conteúdo com assistência de IA. Vai a "Ebooks", clica em "Criar Ebook" e usa os botões de IA para gerar títulos, descrições e conteúdo para os capítulos. A IA sugere conteúdo que podes editar livremente.',
  },
  {
    keywords: ['loja', 'vender', 'vendas'],
    response: 'Para vender online, cria uma loja em "Lojas", associa produtos a ela e cria páginas de vendas personalizadas. Cada página pode ter headlines, imagens, testemunhos e botões de call-to-action para maximizar conversões.',
  },
  {
    keywords: ['campanha', 'anúncio', 'facebook', 'publicidade'],
    response: 'As campanhas publicitárias permitem promover os teus produtos no Facebook, WhatsApp, Instagram e Google. Vai a "Campanhas", cria uma nova campanha com criativo, orçamento e público-alvo. A publicação direta requer configuração das APIs oficiais.',
  },
  {
    keywords: ['pagamento', 'stripe', 'paypal', 'multicaixa'],
    response: 'O LoppAI suporta Visa, Mastercard (via Stripe), PayPal e Multicaixa Express. A configuração dos gateways de pagamento é feita nas Definições. Cada fornecedor requer chaves de API específicas que devem ser obtidas junto das respetivas plataformas.',
  },
  {
    keywords: ['cupão', 'desconto', 'promoção'],
    response: 'Cria cupões de desconto em "Cupons" com códigos personalizados ou gerados automaticamente. Podes definir descontos em percentagem ou valor fixo, limitar o número de usos e definir datas de expiração.',
  },
  {
    keywords: ['afiliado', 'comissão', 'parceiro'],
    response: 'O programa de afiliados permite que parceiros promovam os teus produtos e recebam comissões. Cada afiliado tem um código de referência único para tracking de cliques e conversões.',
  },
  {
    keywords: ['plano', 'subscrição', 'preço', 'atualizar'],
    response: 'O LoppAI tem 3 planos: Free (grátis, 3 produtos), Pro (19.90€/mês, produtos ilimitados) e Enterprise (49.90€/mês, para equipas). Vai a "Planos" para comparar funcionalidades e fazer upgrade.',
  },
];

const defaultResponse = 'Olá! Sou o LoppAI Assistente. Posso ajudar-te com produtos, ebooks, lojas, campanhas, pagamentos, cupões, afiliados e planos. Descreve o que precisas e eu tento guiar-te. Para questões mais complexas, podes abrir um ticket de suporte.';

function getAIResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  for (const r of aiResponses) {
    if (r.keywords.some((k) => lower.includes(k))) return r.response;
  }
  return defaultResponse;
}

export function AISupportPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConv, setActiveConv] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const plan = profile?.plan ?? 'free';
  const PLAN_LIMITS: Record<string, number> = { free: 3, pro: 50, enterprise: 999999 };
  const messageLimit = PLAN_LIMITS[plan] ?? 3;
  const userMessageCount = messages.filter((m) => m.role === 'user').length;
  const limitReached = plan === 'free' && userMessageCount >= messageLimit;

  async function loadConversations() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setConversations((data ?? []) as ChatConversation[]);
    setLoading(false);
  }

  useEffect(() => { loadConversations(); }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function selectConversation(conv: ChatConversation) {
    setActiveConv(conv);
    setMessagesLoading(true);
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as ChatMessage[]);
    setMessagesLoading(false);
  }

  async function newConversation() {
    if (!user) return;
    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({ user_id: user.id, title: 'Nova conversa' })
      .select()
      .single();
    if (!error && data) {
      await loadConversations();
      selectConversation(data as ChatConversation);
    }
  }

  async function deleteConversation(conv: ChatConversation) {
    if (!confirm('Eliminar esta conversa?')) return;
    await supabase.from('chat_conversations').delete().eq('id', conv.id);
    if (activeConv?.id === conv.id) {
      setActiveConv(null);
      setMessages([]);
    }
    loadConversations();
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !user || !activeConv || limitReached) return;

    const userMessage = input.trim();
    setInput('');

    // Insert user message
    const { data: userMsg } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: activeConv.id,
        user_id: user.id,
        role: 'user',
        content: userMessage,
      })
      .select()
      .single();

    if (userMsg) {
      setMessages((prev) => [...prev, userMsg as ChatMessage]);
    }

    // Update conversation title if first message
    if (activeConv.title === 'Nova conversa') {
      const title = userMessage.slice(0, 40) + (userMessage.length > 40 ? '...' : '');
      await supabase.from('chat_conversations').update({ title }).eq('id', activeConv.id);
      setActiveConv({ ...activeConv, title });
    }

    // Simulate AI response
    setAiThinking(true);
    setTimeout(async () => {
      const aiText = getAIResponse(userMessage);
      const { data: aiMsg } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: activeConv.id,
          user_id: user.id,
          role: 'assistant',
          content: aiText,
        })
        .select()
        .single();

      if (aiMsg) {
        setMessages((prev) => [...prev, aiMsg as ChatMessage]);
      }
      setAiThinking(false);
      loadConversations();
    }, 800 + Math.random() * 600);
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Conversations sidebar */}
      <div className="flex w-64 shrink-0 flex-col">
        <button onClick={newConversation} className="btn-primary mb-3 w-full">
          <Plus className="h-4 w-4" />
          Nova conversa
        </button>

        <div className="card flex-1 overflow-y-auto scrollbar-thin p-2">
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div>
          ) : conversations.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs text-slate-400">Sem conversas</p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={cn(
                  'mb-1 flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                  activeConv?.id === conv.id
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                    : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                )}
              >
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{conv.title}</p>
                  <p className="text-xs text-slate-400">{timeAgo(conv.updated_at)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="card flex flex-1 flex-col overflow-hidden">
        {!activeConv ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={Sparkles}
              title="LoppAI Assistente"
              description="Inicia uma nova conversa para obter ajuda sobre produtos, ebooks, lojas, campanhas e mais."
              action={<button onClick={newConversation} className="btn-primary"><Plus className="h-4 w-4" />Nova conversa</button>}
            />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-500/20">
                  <Sparkles className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" style={{ width: 18, height: 18 }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{activeConv.title}</p>
                  <p className="text-xs text-slate-400">LoppAI Assistente{plan !== 'free' && plan !== 'enterprise' ? ` · ${messageLimit} mensagens` : plan === 'enterprise' ? ' · Ilimitado' : ''}</p>
                </div>
              </div>
              <button
                onClick={() => deleteConversation(activeConv)}
                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
              {messagesLoading ? (
                <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 rounded-full bg-blue-100 p-4 dark:bg-blue-500/20">
                    <Bot className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Como posso ajudar?</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Pergunta-me sobre qualquer funcionalidade do LoppAI.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        )}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {aiThinking && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-800">
                        <div className="flex gap-1">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            {limitReached ? (
              <div className="border-t border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-500/10">
                  <Lock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-300">Limite do plano grátis atingido</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400/80">O plano grátis permite {messageLimit} mensagens por conversa. Faz upgrade para continuar a usar o LoppAI Assistente.</p>
                  </div>
                  <button onClick={() => onNavigate('plans')} className="btn-primary shrink-0 text-sm">
                    <Sparkles className="h-4 w-4" />
                    Fazer upgrade
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={sendMessage} className="border-t border-slate-200 p-4 dark:border-slate-800">
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Escreve a tua mensagem..."
                    className="input flex-1"
                    disabled={aiThinking}
                  />
                  <button type="submit" disabled={!input.trim() || aiThinking} className="btn-primary shrink-0">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                {plan === 'free' && (
                  <p className="mt-2 text-xs text-slate-400">
                    {userMessageCount}/{messageLimit} mensagens usadas neste plano grátis
                  </p>
                )}
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
