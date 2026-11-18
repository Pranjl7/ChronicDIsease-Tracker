import { useMemo, useState } from 'react'
import { ArrowDownUp, CalendarRange, HeartPulse, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge, EmptyState, Modal, PageHeader, Skeleton, Toast } from '../components/ui'
import RecordForm from '../components/RecordForm'
import { useSession } from '../context/session'
import { useData } from '../lib/useData'
import { deleteRecord, getRecords, metricById } from '../data/api'
import { diseases, metrics, patientDiseases, symptoms, TODAY, type HealthRecord } from '../data/fixtures'
import { fmtDate, fmtTime, fmtValue, isoDaysAgo } from '../lib/format'

const PAGE = 15

export default function HealthRecords() {
  const { session } = useSession()
  const pid = session!.patientId
  const canEdit = session!.role !== 'doctor' // doctors review; patients/admins edit

  const [metricId, setMetricId] = useState<number | 'all'>('all')
  const [from, setFrom] = useState(isoDaysAgo(TODAY, 30))
  const [to, setTo] = useState(TODAY.toISOString().slice(0, 10))
  const [order, setOrder] = useState<'desc' | 'asc'>('desc')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<HealthRecord | 'new' | null>(null)
  const [confirm, setConfirm] = useState<HealthRecord | null>(null)
  const [toast, setToast] = useState<{ message: string; alert: boolean } | null>(null)

  const { data, loading } = useData(() => getRecords({ patientId: pid, metricId, from, to, order }), [pid, metricId, from, to, order])
  const rows = data ?? []
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const visible = useMemo(() => rows.slice(page * PAGE, page * PAGE + PAGE), [rows, page])

  const conditionName = (pdId: number | null) => {
    if (!pdId) return null
    const pd = patientDiseases.find((p) => p.patient_disease_id === pdId)
    return diseases.find((d) => d.disease_id === pd?.disease_id)?.name ?? null
  }

  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v)
    setPage(0)
  }

  return (
    <>
      <PageHeader
        eyebrow="Module 4 · Health records"
        title="Health records"
        description="Every measurement is stored as its own timestamped row, linked to a metric definition and, optionally, to one of your conditions."
        actions={canEdit && <button className="btn btn-primary" onClick={() => setEditing('new')}><Plus className="size-4" /> Add record</button>}
      />

      {/* Filters — one row above the table */}
      <div className="card mb-4 flex flex-col gap-3 p-4 md:flex-row md:items-end">
        <div className="md:w-64">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-mute" htmlFor="fm">Metric</label>
          <select id="fm" className="field" value={metricId} onChange={(e) => resetPage(setMetricId)(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">All metrics</option>
            {metrics.map((m) => <option key={m.metric_id} value={m.metric_id}>{m.metric_name}</option>)}
          </select>
        </div>
        <div className="flex gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-mute" htmlFor="ff">From</label>
            <input id="ff" type="date" className="field num" value={from} max={to} onChange={(e) => resetPage(setFrom)(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-mute" htmlFor="ft">To</label>
            <input id="ft" type="date" className="field num" value={to} min={from} onChange={(e) => resetPage(setTo)(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-1.5">
          {[7, 30, 90].map((n) => (
            <button key={n} className="btn btn-ghost !px-3 !py-2 text-xs" onClick={() => { setFrom(isoDaysAgo(TODAY, n)); setTo(TODAY.toISOString().slice(0, 10)); setPage(0) }}>
              {n}d
            </button>
          ))}
        </div>
        <button className="btn btn-ghost md:ml-auto" onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}>
          <ArrowDownUp className="size-4" /> {order === 'desc' ? 'Newest first' : 'Oldest first'}
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3 text-xs text-ink-mute">
          <span className="flex items-center gap-1.5"><CalendarRange className="size-3.5" /> {fmtDate(from)} – {fmtDate(to)}</span>
          <span className="num">{rows.length} records</span>
        </div>
        {loading ? (
          <div className="space-y-2 p-5">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : !rows.length ? (
          <EmptyState icon={<HeartPulse className="size-5" />} title="No records in this range">Try widening the date range or choosing a different metric.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-canvas/60 text-left text-[11px] uppercase tracking-wider text-ink-mute">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Recorded</th>
                  <th className="px-3 py-2.5 font-semibold">Metric</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Value</th>
                  <th className="px-3 py-2.5 font-semibold">Condition</th>
                  <th className="px-3 py-2.5 font-semibold">Symptoms & notes</th>
                  {canEdit && <th className="px-5 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const m = metricById(r.metric_id)
                  const cond = conditionName(r.patient_disease_id)
                  return (
                    <tr key={r.record_id} className="group border-t border-line hover:bg-canvas/50">
                      <td className="whitespace-nowrap px-5 py-3">
                        <span className="font-medium">{fmtDate(r.recorded_at)}</span>
                        <span className="num ml-2 text-xs text-ink-mute">{fmtTime(r.recorded_at)}</span>
                      </td>
                      <td className="px-3 py-3">{m.metric_name}</td>
                      <td className="num whitespace-nowrap px-3 py-3 text-right font-semibold">
                        {fmtValue(r.metric_id, r.recorded_value)} <span className="font-normal text-ink-mute">{m.unit}</span>
                      </td>
                      <td className="px-3 py-3">{cond ? <Badge tone="blue">{cond}</Badge> : <span className="text-ink-mute">–</span>}</td>
                      <td className="max-w-[280px] px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {r.symptom_ids.map((id) => (
                            <Badge key={id} tone="violet">{symptoms.find((s) => s.symptom_id === id)?.name}</Badge>
                          ))}
                        </div>
                        {r.notes && <p className="mt-0.5 truncate text-xs text-ink-soft">{r.notes}</p>}
                        {!r.notes && !r.symptom_ids.length && <span className="text-ink-mute">–</span>}
                      </td>
                      {canEdit && (
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          <button className="rounded-lg p-1.5 text-ink-mute hover:bg-white hover:text-ink" onClick={() => setEditing(r)} aria-label="Edit record"><Pencil className="size-4" /></button>
                          <button className="rounded-lg p-1.5 text-ink-mute hover:bg-rose-soft hover:text-rose-brand" onClick={() => setConfirm(r)} aria-label="Delete record"><Trash2 className="size-4" /></button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > PAGE && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
            <span className="num text-xs text-ink-mute">Page {page + 1} of {pages}</span>
            <div className="flex gap-2">
              <button className="btn btn-ghost !py-1.5" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
              <button className="btn btn-ghost !py-1.5" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add health record' : 'Edit health record'}>
        {editing !== null && (
          <RecordForm
            key={editing === 'new' ? 'new' : editing.record_id}
            patientId={pid}
            existing={editing === 'new' ? undefined : editing}
            onDone={(r) => { setEditing(null); setToast(r) }}
          />
        )}
      </Modal>

      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title="Delete this record?">
        {confirm && (
          <>
            <p className="text-sm text-ink-soft">
              {metricById(confirm.metric_id).metric_name} of <span className="num font-semibold text-ink">{fmtValue(confirm.metric_id, confirm.recorded_value)} {metricById(confirm.metric_id).unit}</span> on {fmtDate(confirm.recorded_at)}.
              Linked symptoms are removed with it. Any alert it raised is kept, without the link to this record.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn bg-rose-brand text-white hover:opacity-90" onClick={async () => {
                try {
                  await deleteRecord(confirm.record_id)
                  setToast({ message: 'Record deleted', alert: false })
                } catch (e) {
                  setToast({ message: e instanceof Error ? e.message : 'Could not delete the record', alert: true })
                }
                setConfirm(null)
              }}>
                <Trash2 className="size-4" /> Delete
              </button>
            </div>
          </>
        )}
      </Modal>
      <Toast message={toast?.message ?? null} tone={toast?.alert ? 'amber' : 'teal'} onDone={() => setToast(null)} />
    </>
  )
}
