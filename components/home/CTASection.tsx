'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { ArrowLeft } from 'lucide-react'

export function CTASection() {
  return (
    <section className="py-20 px-4 bg-gradient-to-l from-amber-500 to-amber-600" dir="rtl">
      <div className="max-w-4xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl md:text-5xl font-bold text-white mb-6"
        >
          جاهز لقصة شعرك القادمة؟
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-xl text-amber-100 mb-8"
        >
          احجز موعدك اليوم واستمتع بخدمات حلاقة متميزة
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          <Button asChild size="lg" variant="secondary" className="text-lg px-8 py-6">
            <Link href="/book">
              احجز الآن
              <ArrowLeft className="mr-2" size={20} />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  )
}