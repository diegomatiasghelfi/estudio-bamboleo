import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { NewsItem } from '../lib/types'

// Flyers incluidos en la app, por si la tabla de novedades todavía no existe.
const FALLBACK: NewsItem[] = [
  { id: 'f1', title: 'Vueltas en pareja estilo lineal y cubano', image_url: '/flyers/vueltas-en-pareja.jpg', link: null, active: true, sort_order: 1, created_at: '' },
  { id: 'f2', title: 'Muestra anual + social', image_url: '/flyers/muestra-anual.jpg', link: null, active: true, sort_order: 2, created_at: '' },
  { id: 'f3', title: 'Bachata dominicana y merengue desde cero', image_url: '/flyers/bachata-merengue.jpg', link: null, active: true, sort_order: 3, created_at: '' },
]

const INTERVAL = 5000

export default function NewsCarousel() {
  const [items, setItems] = useState<NewsItem[] | null>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const track = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase
      .from('news')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => setItems(error ? FALLBACK : ((data ?? []) as NewsItem[])))
  }, [])

  // Avance automático
  useEffect(() => {
    if (!items || items.length < 2 || paused) return
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), INTERVAL)
    return () => clearInterval(t)
  }, [items, paused])

  // Mover el carrusel cuando cambia el índice
  useEffect(() => {
    const el = track.current
    if (el) el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
  }, [index])

  if (!items || items.length === 0) return null

  function onScroll() {
    const el = track.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== index) setIndex(i)
  }

  return (
    <section aria-label="Novedades" className="relative overflow-hidden rounded-3xl bg-cocoa shadow-lg">
      <div
        ref={track}
        onScroll={onScroll}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setTimeout(() => setPaused(false), 3000)}
        className="no-scrollbar flex aspect-[5/4] snap-x snap-mandatory overflow-x-auto"
      >
        {items.map((n) => {
          const img = <img src={n.image_url} alt={n.title || 'Novedad'} className="h-full w-full object-cover" loading="lazy" draggable={false} />
          return (
            <div key={n.id} className="h-full w-full shrink-0 snap-center">
              {n.link ? (
                <a href={n.link} target="_blank" rel="noreferrer" className="block h-full w-full">{img}</a>
              ) : (
                img
              )}
            </div>
          )
        })}
      </div>
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-cocoa/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-gold">
        Novedades
      </span>
      {items.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {items.map((n, i) => (
            <button
              key={n.id}
              onClick={() => setIndex(i)}
              aria-label={`Ver novedad ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-5 bg-gold' : 'w-2 bg-cream/70'}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
