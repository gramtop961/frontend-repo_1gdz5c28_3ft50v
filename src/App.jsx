import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Send, User, Wifi } from 'lucide-react'
import Spline from '@splinetool/react-spline'
import {
  initializeApp,
  getApps,
} from 'firebase/app'
import {
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged,
} from 'firebase/auth'
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore'

// Single-file React Chat App using Firebase Firestore real-time updates
// Dark, mobile-first UI with TailwindCSS

const __app_id = 'global-chat'

// Accept optional initial auth token from global/window scope
const getInitialAuthToken = () => {
  if (typeof window !== 'undefined') {
    // Allow env-style injection via global
    return window.__initial_auth_token || null
  }
  return null
}

const shortId = (uid) => (uid ? uid.slice(0, 8) : 'unknown')

export default function ChatApp() {
  const [userId, setUserId] = useState(null)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [status, setStatus] = useState('Connecting...')

  const appRef = useRef(null)
  const dbRef = useRef(null)
  const endRef = useRef(null)
  const unsubRef = useRef(null)

  const collectionPath = useMemo(
    () => `/artifacts/${__app_id}/public/data/global_chat`,
    []
  )

  // Firebase config should be provided via environment or window.__firebase_config
  const firebaseConfig = useMemo(() => {
    const injected = typeof window !== 'undefined' ? window.__firebase_config : null
    // Fallback to placeholders to avoid crashes. Replace with real keys at runtime.
    return injected || {
      apiKey: 'demo-api-key',
      authDomain: 'demo.firebaseapp.com',
      projectId: 'demo',
      appId: '1:123:web:demo',
    }
  }, [])

  useEffect(() => {
    // Initialize Firebase app once
    try {
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
      appRef.current = app
      const auth = getAuth(app)
      const token = getInitialAuthToken()
      const doAuth = async () => {
        try {
          if (token) {
            await signInWithCustomToken(auth, token)
          } else {
            await signInAnonymously(auth)
          }
        } catch (err) {
          console.error('Auth error:', err)
        }
      }

      const unsub = onAuthStateChanged(auth, async (user) => {
        if (user) {
          setUserId(user.uid)
          setIsAuthReady(true)
          setStatus('Online')
        } else {
          setStatus('Auth required')
          await doAuth()
        }
      })

      // Attempt auth immediately (handles cold start)
      doAuth()

      return () => {
        unsub && unsub()
      }
    } catch (e) {
      console.error('Firebase init error:', e)
      setStatus('Init error')
    }
  }, [firebaseConfig])

  useEffect(() => {
    if (!isAuthReady || !userId) return
    try {
      const db = getFirestore(appRef.current)
      dbRef.current = db
      const colRef = collection(db, collectionPath)

      unsubRef.current && unsubRef.current()
      unsubRef.current = onSnapshot(
        colRef,
        (snap) => {
          const docs = []
          snap.forEach((d) => {
            const data = d.data() || {}
            docs.push({ id: d.id, ...data })
          })
          // Sort client-side by timestamp (serverTimestamp may be null on first write)
          docs.sort((a, b) => {
            const ta = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0
            const tb = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0
            return ta - tb
          })
          setMessages(docs)
        },
        (error) => {
          console.error('Snapshot error:', error)
        }
      )
    } catch (e) {
      console.error('Firestore subscribe error:', e)
    }

    return () => {
      unsubRef.current && unsubRef.current()
    }
  }, [isAuthReady, userId, collectionPath])

  useEffect(() => {
    // Auto scroll to bottom on new messages
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = async () => {
    if (!dbRef.current || !userId) return
    const text = newMessage.trim()
    if (!text) return
    try {
      await addDoc(collection(dbRef.current, collectionPath), {
        text,
        userId,
        timestamp: serverTimestamp(),
      })
      setNewMessage('')
    } catch (e) {
      console.error('Send error:', e)
    }
  }

  const isSendDisabled = !isAuthReady || !userId || newMessage.trim().length === 0

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Hero with Spline cover */}
      <div className="relative h-40 w-full overflow-hidden">
        <Spline scene="https://prod.spline.design/zhZFnwyOYLgqlLWk/scene.splinecode" style={{ width: '100%', height: '100%' }} />
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-pink-500/20 pointer-events-none" />
      </div>

      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-20 bg-gray-900/80 backdrop-blur border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent text-lg font-semibold">Global Chat</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/70">
            <Wifi size={16} className={status === 'Online' ? 'text-cyan-400' : 'text-pink-400'} />
            <span>{status}</span>
            <User size={16} className="text-white/60" />
            <span>{shortId(userId)}</span>
          </div>
        </div>
      </header>

      {/* Chat content area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pb-28 pt-24">
        <ul className="flex flex-col gap-3">
          {messages.map((m) => {
            const mine = m.userId === userId
            return (
              <li key={m.id} className={`flex flex-col ${mine ? 'self-end items-end' : 'self-start items-start'}`}>
                <span className="text-[10px] uppercase tracking-wider text-white/50 mb-1">{shortId(m.userId)}</span>
                <div className={`${mine ? 'bg-cyan-500 text-white rounded-2xl rounded-tr-none' : 'bg-gray-800 text-white rounded-2xl rounded-tl-none'} px-3 py-2 max-w-[80%] shadow-md`}> 
                  <p className="whitespace-pre-wrap break-words leading-relaxed text-sm">{m.text}</p>
                </div>
              </li>
            )
          })}
          <div ref={endRef} />
        </ul>
      </main>

      {/* Fixed Footer composer */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 bg-gray-900/80 backdrop-blur border-t border-white/10">
        <div className="max-w-3xl mx-auto px-3 py-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="flex-1 bg-gray-800 text-white placeholder-white/40 rounded-xl px-4 py-3 outline-none focus:ring-2 ring-cyan-400/50"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend()
              }}
            />
            <button
              onClick={handleSend}
              disabled={isSendDisabled}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-pink-500 text-gray-900 font-semibold transition-opacity ${isSendDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
              aria-label="Send"
            >
              <Send size={18} />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
          <p className="mt-2 text-[10px] text-white/40">Messages are public. Be kind.</p>
        </div>
      </footer>
    </div>
  )
}
