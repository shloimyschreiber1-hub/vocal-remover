'use client'

import { useState } from 'react'
import { CloseIcon } from './icons'

interface ContactModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    setErrorMessage('')

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        setStatus('success')
        setFormData({ name: '', email: '', subject: '', message: '' })
        setTimeout(() => {
          onClose()
          setStatus('idle')
        }, 2000)
      } else {
        setStatus('error')
        setErrorMessage(data.error || 'Failed to send message')
      }
    } catch (error) {
      setStatus('error')
      setErrorMessage('An unexpected error occurred. Please try again.')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 px-4 py-6 overflow-y-auto animate-fade-in">
      <div className="bg-[#161616] border border-white/10 rounded-2xl sm:rounded-lg p-6 sm:p-8 max-w-lg w-full my-auto animate-fade-in-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Contact us</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors"
            disabled={status === 'sending'}
          >
            <CloseIcon width={20} height={20} />
          </button>
        </div>

        {status === 'success' ? (
          <div className="py-8 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mx-auto mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-8 h-8"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Message sent!</h3>
            <p className="text-white/60">We&apos;ll get back to you as soon as possible.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2 text-white/80">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                disabled={status === 'sending'}
                className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-lg focus:outline-none focus:border-[#4d7cff] transition-colors text-white placeholder:text-white/30 disabled:opacity-50"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2 text-white/80">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={status === 'sending'}
                className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-lg focus:outline-none focus:border-[#4d7cff] transition-colors text-white placeholder:text-white/30 disabled:opacity-50"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-medium mb-2 text-white/80">
                Subject
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                disabled={status === 'sending'}
                className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-lg focus:outline-none focus:border-[#4d7cff] transition-colors text-white placeholder:text-white/30 disabled:opacity-50"
                placeholder="What can we help with?"
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium mb-2 text-white/80">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                disabled={status === 'sending'}
                rows={5}
                className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-lg focus:outline-none focus:border-[#4d7cff] transition-colors text-white placeholder:text-white/30 resize-none disabled:opacity-50"
                placeholder="Tell us more..."
              />
            </div>

            {status === 'error' && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm animate-fade-in">
                {errorMessage}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={status === 'sending'}
                className={`flex-1 px-6 py-3 bg-[#4d7cff] text-white rounded-lg font-medium transition-all ${
                  status === 'sending'
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:bg-[#3f6cf5] hover:scale-[1.02]'
                }`}
              >
                {status === 'sending' ? 'Sending...' : 'Send message'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={status === 'sending'}
                className={`px-6 py-3 border border-white/20 rounded-lg font-medium transition-colors ${
                  status === 'sending'
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:border-white/50'
                }`}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
