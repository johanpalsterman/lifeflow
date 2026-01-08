// src/components/Navigation.tsx
// Main navigation component

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, Settings, ShoppingBag, Clock, Zap, Package,
  Calendar, CheckSquare, FileText, Menu, X
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/orders', label: 'Bestellingen', icon: ShoppingBag },
  { href: '/settings', label: 'Instellingen', icon: Settings },
  { href: '/history', label: 'Geschiedenis', icon: Clock },
];

export default function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-gray-900 border-r border-gray-800 flex-col p-4">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-purple-400 flex items-center gap-2">
            <Zap className="w-6 h-6" />
            LifeFlow
          </h1>
        </div>
        
        <div className="space-y-2">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive 
                    ? 'bg-purple-600 text-white' 
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
        
        <div className="mt-auto pt-4 border-t border-gray-800">
          <div className="text-xs text-gray-600 text-center">
            WishFlow Suite v1.0
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 z-50">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-lg font-bold text-purple-400 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            LifeFlow
          </h1>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-gray-800 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        
        {mobileMenuOpen && (
          <div className="px-4 pb-4 space-y-2">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    isActive 
                      ? 'bg-purple-600 text-white' 
                      : 'text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
