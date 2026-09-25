'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { ArrowLeft } from 'lucide-react'

interface HeroSectionProps {
  bio?: string | null
}

export function HeroSection({ bio }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-black dark:via-gray-900 dark:to-black py-20 px-4" dir="rtl">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-[1.3] pb-3 bg-gradient-to-l from-amber-400 to-amber-600 bg-clip-text text-transparent">
            تجربة حلاقة متميزة
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-2xl mx-auto">
            {bio || 'قصات احترافية، أسلوب كلاسيكي، تقنيات حديثة'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <Link href="/book">
                احجز موعدك
                <ArrowLeft className="mr-2" size={20} />
              </Link>
            </Button>
            {/* <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6"> // ← تم تعليق زر عرض المعرض
              <Link href="/gallery">عرض المعرض</Link>
            </Button> */}
          </div>
        </motion.div>
      </div>
    </section>
  )
}