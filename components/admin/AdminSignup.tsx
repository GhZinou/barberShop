'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

export function AdminSignup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Sign up user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin`,
        },
      })

      if (signUpError) {
        console.error('Signup error details:', signUpError)
        throw signUpError
      }
      
      // Check if user was actually created
      if (!authData.user) {
        throw new Error('فشل في إنشاء الحساب. يرجى المحاولة مرة أخرى.')
      }
      
      console.log('User created:', authData.user.id)

      if (authData.user) {
        // Check if we have a session from signup
        const { data: { session: signupSession } } = await supabase.auth.getSession()
        
        let session = signupSession
        
        // If no session, try to sign in (but don't fail if it doesn't work immediately)
        if (!session) {
          // Wait a moment for account to be fully created
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          })
          
          if (signInError) {
            // If sign in fails, redirect to login page with message
            console.warn('Auto sign-in failed, redirecting to login:', signInError.message)
            router.push('/admin/login?message=تم إنشاء الحساب. يرجى تسجيل الدخول.')
            return
          }
          
          session = signInData.session
        }

        // If we have a session, create the barber profile
        if (session) {
          // Create barber profile - now with authenticated session
          const { error: profileError } = await supabase
            .from('barber_profile')
            // @ts-ignore - Supabase type inference issue with string literal table names
            .insert({
              user_id: authData.user.id,
              name,
            })

          if (profileError) {
            // If RLS still fails, redirect to setup page
            if (profileError.message.includes('row-level security')) {
              console.warn('Profile creation failed, redirecting to setup:', profileError.message)
              router.push('/admin/setup')
              return
            }
            throw profileError
          }

          router.push('/admin')
          router.refresh()
        } else {
          // No session, redirect to login
          router.push('/admin/login?message=تم إنشاء الحساب. يرجى تسجيل الدخول.')
        }
      } else {
        throw new Error('تم إنشاء الحساب ولكن بيانات المستخدم غير متاحة. يرجى محاولة تسجيل الدخول.')
      }
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err.message || 'فشل في إنشاء الحساب')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-8"
      dir="rtl"
    >
      <h1 className="text-3xl font-bold mb-2 text-center">إنشاء حساب المسؤول</h1>
      <p className="text-gray-600 dark:text-gray-400 text-center mb-8">
        قم بإعداد ملفك الشخصي كحلاق
      </p>

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            الاسم
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="اسمك"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            البريد الإلكتروني
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="your.email@example.com"
            dir="ltr"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">
            كلمة المرور
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="••••••••"
            minLength={6}
            dir="ltr"
          />
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
            {error}
          </div>
        )}

        <Button type="submit" disabled={loading} className="w-full" size="lg">
          {loading ? (
            <>
              <Loader2 className="ml-2 animate-spin" size={20} />
              جاري إنشاء الحساب...
            </>
          ) : (
            'إنشاء الحساب'
          )}
        </Button>
      </form>

      <p className="text-sm text-gray-500 dark:text-gray-500 text-center mt-6">
        لديك حساب بالفعل؟{' '}
        <a href="/admin/login" className="text-amber-500 hover:text-amber-600">
          تسجيل الدخول
        </a>
      </p>
    </motion.div>
  )
}