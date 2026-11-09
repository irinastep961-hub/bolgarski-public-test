import { notFound } from 'next/navigation';
import ConversationPlayer from '@/components/conversation/ConversationPlayer';
import Link from 'next/link';
import { conversations, getConversation } from '@/content/conversations';
import { isConversationFree } from '@/config/publicTest';

export function generateStaticParams() {
  return conversations.map((c) => ({ id: c.id }));
}

export default async function SpeakingConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = getConversation(id);
  if (!conversation) notFound();
  if (!isConversationFree(id)) {
    return (
      <main className="page center">
        <div className="card lockedpage">
          <div className="badge" aria-hidden>🔒</div>
          <h1>{conversation.title}</h1>
          <p>Эта ситуация относится к урокам, которые пока закрыты в пробной версии.</p>
        </div>
        <Link href="/speaking" className="btn">К разговорной практике</Link>
      </main>
    );
  }
  return <ConversationPlayer conversation={conversation} />;
}
