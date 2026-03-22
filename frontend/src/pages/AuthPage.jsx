import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function AuthPage() {
  const { login, register, error, setError } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      if (isLogin) {
        await login(form.email, form.password)
      } else {
        if (!form.name.trim()) { setError('Name is required'); setSubmitting(false); return }
        await register(form.name, form.email, form.password, form.phone)
      }
    } catch {}
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-6 bg-surface-container-low">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 md:mb-10">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>shield_with_heart</span>
          </div>
          <h1 className="text-2xl font-extrabold text-on-surface font-headline">SafeSage</h1>
          <p className="text-sm text-on-surface-variant mt-1">The Digital Guardian</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-surface-container-lowest p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-outline-variant/10">
          <h2 className="text-xl font-bold text-on-surface mb-6 text-center font-headline">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-error-container/30 border border-error/10 mb-6 text-sm text-on-error-container">
              <span className="material-symbols-outlined text-error">error</span>
              {error}
            </div>
          )}

          <div className="space-y-4">
            {!isLogin && (
              <input className="input-field" placeholder="Full Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            )}

            <input className="input-field" type="email" placeholder="Email address" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />

            <div className="relative">
              <input className="input-field" type={showPassword ? 'text' : 'password'} placeholder="Password" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={{ paddingRight: 48 }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>

            {!isLogin && (
              <input className="input-field" type="tel" placeholder="Phone (optional)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            )}
          </div>

          <button type="submit" disabled={submitting}
            className="w-full mt-6 py-4 bg-primary text-on-primary rounded-2xl font-bold text-base hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {submitting ? (
              <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
            ) : (
              isLogin ? 'Sign In' : 'Create Account'
            )}
          </button>

          <div className="text-center mt-6">
            <span className="text-sm text-on-surface-variant">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
            </span>
            <button type="button" onClick={() => { setIsLogin(!isLogin); setError(null) }}
              className="text-sm text-primary font-bold hover:underline">
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
