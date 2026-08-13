'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface MobileBottomNavProps {
  items: {
    href: string;
    label: string;
    icon: LucideIcon;
  }[];
  className?: string;
}

export function MobileBottomNav({ items, className }: MobileBottomNavProps) {
  const pathname = usePathname();
  
  // Max 5 items as requested
  const displayItems = items.slice(0, 5);

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <nav
        className={cn(
          "pointer-events-auto",
          "bg-bg-card/90 backdrop-blur-xl border-t border-border-subtle shadow-[var(--shadow-elevated)]",
          "pb-[env(safe-area-inset-bottom)]", // iOS safe area
          className
        )}
      >
        <div className="flex justify-around items-center h-16 px-2">
          {displayItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors relative",
                  isActive
                    ? "text-[var(--color-primary)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                )}
              >
                {isActive && (
                  <span className="absolute top-1 w-12 h-1 bg-[var(--color-primary-subtle)] rounded-full" />
                )}
                <div 
                  className={cn(
                    "flex items-center justify-center rounded-full p-1.5 transition-colors",
                    isActive ? "bg-[var(--color-primary-subtle)]" : "bg-transparent"
                  )}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={cn(
                  "text-[10px] font-medium leading-none",
                  isActive ? "font-semibold" : "font-medium"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
