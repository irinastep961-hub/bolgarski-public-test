'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Уроки', icon: '🗺️' },
  { href: '/words', label: 'Слова', icon: '📖' },
  { href: '/speaking', label: 'Говорить', icon: '🎤' },
  { href: '/review', label: 'Повтор', icon: '🔁' },
  { href: '/stats', label: 'Успехи', icon: '📈' },
];

export default function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar" aria-label="Разделы">
      {TABS.map((t) => {
        const active = t.href === '/' ? pathname === '/' : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={'tab' + (active ? ' active' : '')} aria-current={active ? 'page' : undefined}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
