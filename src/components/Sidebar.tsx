import { useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Check, Clapperboard, FileUp, LayoutGrid, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { Category } from '../types'

interface SidebarProps {
  categories: Category[]
  counts: Record<string, number>
  selected: string
  onSelect: (id: string) => void
  onAddCategory: (name: string) => void
  onRenameCategory: (id: string, name: string) => void
  onDeleteCategory: (id: string) => void
}

export function Sidebar({
  categories,
  counts,
  selected,
  onSelect,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
}: SidebarProps) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  const submitNew = () => {
    const name = newName.trim()
    if (name) {
      onAddCategory(name)
      setNewName('')
    }
    setAdding(false)
  }

  const submitEdit = () => {
    if (editingId && editName.trim()) onRenameCategory(editingId, editName.trim())
    setEditingId(null)
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-hairline bg-panel">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-pink-400 shadow-lg shadow-accent/30">
          <Clapperboard size={16} className="text-white" />
        </span>
        <div>
          <h1 className="font-display text-sm font-bold leading-tight text-white">StreamLab</h1>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Player M3U8</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-3">
        <SidebarItem
          icon={<LayoutGrid size={15} />}
          label="Todas as mídias"
          count={total}
          active={selected === 'all'}
          onClick={() => onSelect('all')}
        />
        <SidebarItem
          icon={<span className="size-2 rounded-full bg-zinc-500" />}
          label="Sem categoria"
          count={counts['none'] ?? 0}
          active={selected === 'none'}
          onClick={() => onSelect('none')}
        />

        <div className="mt-4 mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
          Categorias
        </div>

        {categories.map((c) => (
          <div
            key={c.id}
            className="group relative flex items-center rounded-lg text-sm transition"
          >
            <SidebarItem
              icon={<span className="size-2 rounded-full" style={{ background: c.color }} />}
              label={c.name}
              count={counts[c.id] ?? 0}
              active={selected === c.id}
              onClick={() => onSelect(c.id)}
            />
            <div className="absolute right-1.5 hidden items-center gap-0.5 group-hover:flex">
              <button
                onClick={() => {
                  setEditingId(c.id)
                  setEditName(c.name)
                }}
                className="rounded-md p-1 text-zinc-500 transition hover:bg-white/10 hover:text-white"
                aria-label={`Renomear ${c.name}`}
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Excluir a categoria "${c.name}"? Os links dela ficarão sem categoria.`)) {
                    onDeleteCategory(c.id)
                  }
                }}
                className="rounded-md p-1 text-zinc-500 transition hover:bg-red-500/20 hover:text-red-400"
                aria-label={`Excluir ${c.name}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}

        {editingId && (
          <div className="flex items-center gap-1 rounded-lg bg-panel2 px-2 py-1.5">
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitEdit()
                if (e.key === 'Escape') setEditingId(null)
              }}
              className="w-full bg-transparent text-sm text-white outline-none"
            />
            <button onClick={submitEdit} className="text-emerald-400 hover:text-emerald-300" aria-label="Salvar">
              <Check size={14} />
            </button>
            <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-white" aria-label="Cancelar">
              <X size={14} />
            </button>
          </div>
        )}

        {adding ? (
          <div className="mt-1.5 flex items-center gap-1 rounded-lg bg-panel2 px-2 py-1.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNew()
                if (e.key === 'Escape') setAdding(false)
              }}
              placeholder="Nome da categoria"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
            />
            <button onClick={submitNew} className="text-emerald-400 hover:text-emerald-300" aria-label="Salvar">
              <Check size={14} />
            </button>
            <button onClick={() => setAdding(false)} className="text-zinc-500 hover:text-white" aria-label="Cancelar">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-1.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
          >
            <Plus size={14} /> Nova categoria
          </button>
        )}
      </nav>

      <div className="border-t border-hairline px-4 py-3 text-[11px] text-zinc-600">
        <p className="flex items-center gap-1.5">
          <FileUp size={12} /> Importe listas <span className="text-zinc-500">.m3u</span> pelo botão ao lado
        </p>
      </div>
    </aside>
  )
}

function SidebarItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: ReactNode
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition ${
        active ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
      }`}
    >
      <span className="flex size-4 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${active ? 'bg-accent/25 text-accent-100' : 'bg-white/5 text-zinc-500'}`}>
        {count}
      </span>
    </motion.button>
  )
}
