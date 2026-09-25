'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useThemeStore } from '@/store/useThemeStore'
import { Moon, Sun, Menu, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

export function Navbar() {
  const { isDark, toggleTheme } = useThemeStore()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch by only rendering theme-dependent content after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const navItems = [
    { href: '/', label: 'الرئيسية' },
    // { href: '/gallery', label: 'معرض الصور' }, // ← تم تعليق معرض الصور
    { href: '/services', label: 'الخدمات' },
    { href: '/book', label: 'احجز الآن' },
    { href: '/admin', label: 'لوحة التحكم' },
  ]

  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/10" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="text-2xl font-bold">
            AD <span className="text-amber-500">Barber Shop</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8 space-x-reverse">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'transition-colors hover:text-amber-500',
                  pathname === item.href ? 'text-amber-500' : ''
                )}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="تبديل المظهر"
            >
              {mounted ? (isDark ? <Sun size={20} /> : <Moon size={20} />) : <Moon size={20} />}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-4 space-x-reverse">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="تبديل المظهر"
            >
              {mounted ? (isDark ? <Sun size={20} /> : <Moon size={20} />) : <Moon size={20} />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="تبديل القائمة"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-white/10"
          >
            <div className="px-4 py-4 space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'block transition-colors hover:text-amber-500',
                    pathname === item.href ? 'text-amber-500' : ''
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}