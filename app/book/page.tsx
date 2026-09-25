import { Suspense } from 'react'
import { BookingFlow } from '@/components/booking/BookingFlow'

export default function BookPage() {
  return (
    <div className="min-h-screen py-20 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 leading-[1.3] pb-2">
            احجز موعدك
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            اختر التاريخ والوقت المناسبين لك
          </p>
        </div>
        <Suspense fallback={null}>
          <BookingFlow />
        </Suspense>
      </div>
    </div>
  )
}