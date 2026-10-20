'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Card, EmptyState } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { useWork } from '@/components/work/context';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import type { Service, ServiceCategory } from '@/types/business';
import type { ServiceCategoryWithServices, ServiceInput } from '@/types/work-manage';
import { ConfirmModal, ErrorBlock, Loading, digitsOnly } from '../shared';
import { useApi } from '../use-api';

function duration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

type Editing = { categoryId: string; service: Service | null } | null;

export function ServicesSettings() {
  const { businessId } = useWork();
  const { data, error, loading, reload } = useApi<{ categories: ServiceCategoryWithServices[] }>(`/businesses/${businessId}/service-categories`);
  const [addingCategory, setAddingCategory] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<{ kind: 'service'; item: Service } | { kind: 'category'; item: ServiceCategoryWithServices } | null>(null);

  const categories = data?.categories ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Services</h1>
          <p className="mt-1 text-ink-2">Your menu, grouped into categories. Prices are in KSh.</p>
        </div>
        <Button onClick={() => setAddingCategory(true)}>Add category</Button>
      </div>

      {error && !data ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : categories.length === 0 ? (
        <EmptyState
          title="No services yet"
          body="Start with a category, like “Haircuts”, then add the services in it."
          action={<Button onClick={() => setAddingCategory(true)}>Add category</Button>}
        />
      ) : (
        categories.map((c) => (
          <Card key={c.categoryId} className="p-0!">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <h2 className="text-lg font-bold">{c.name}</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing({ categoryId: c.categoryId, service: null })}>
                  Add service
                </Button>
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting({ kind: 'category', item: c })}>
                  Delete
                </Button>
              </div>
            </div>
            {c.services.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-2">No services in this category yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {c.services.map((s) => (
                  <li key={s.serviceId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-sm text-ink-2">{duration(s.durationMinutes)}</p>
                    </div>
                    <p className="font-semibold tabular-nums">{money(s.price)}</p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ categoryId: c.categoryId, service: s })} aria-label={`Edit ${s.name}`}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting({ kind: 'service', item: s })} aria-label={`Delete ${s.name}`}>
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))
      )}

      <CategoryModal
        open={addingCategory}
        onClose={() => setAddingCategory(false)}
        onDone={() => {
          setAddingCategory(false);
          reload();
        }}
      />
      <ServiceModal
        key={editing ? `${editing.categoryId}:${editing.service?.serviceId ?? 'new'}` : 'closed'}
        editing={editing}
        onClose={() => setEditing(null)}
        onDone={() => {
          setEditing(null);
          reload();
        }}
      />
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={deleting?.kind === 'category' ? `Delete “${deleting.item.name}”?` : `Delete “${deleting?.item.name}”?`}
        body={
          deleting?.kind === 'category'
            ? deleting.item.services.length
              ? `Its ${deleting.item.services.length} ${deleting.item.services.length === 1 ? 'service goes' : 'services go'} too. Past bookings keep their details.`
              : 'This category is empty.'
            : 'Customers can no longer book it. Past bookings keep their details.'
        }
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (!deleting) return;
          const path =
            deleting.kind === 'category'
              ? `/businesses/${businessId}/service-categories/${deleting.item.categoryId}`
              : `/businesses/${businessId}/services/${deleting.item.serviceId}`;
          try {
            await api(path, { method: 'DELETE' });
            toast.success(`${deleting.item.name} deleted`);
            setDeleting(null);
            reload();
          } catch (err) {
            toast.error(errorMessage(err, "Couldn't delete it."));
          }
        }}
      />
    </div>
  );
}

function CategoryModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { businessId } = useWork();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Enter a name.');
    setSaving(true);
    try {
      await api<ServiceCategory>(`/businesses/${businessId}/service-categories`, { method: 'POST', body: { name: name.trim() } });
      toast.success('Category added');
      setName('');
      setError(null);
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Couldn't add it."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New category"
      locked={saving}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" loading={saving}>
            Add category
          </Button>
        </div>
      }
    >
      <form id="category-form" onSubmit={submit} className="pb-2" noValidate>
        <Input label="Name" placeholder="e.g. Haircuts" value={name} onChange={(e) => setName(e.target.value)} error={error ?? undefined} maxLength={100} autoFocus />
      </form>
    </Modal>
  );
}

const DURATIONS = [10, 15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 420, 480];

function ServiceModal({ editing, onClose, onDone }: { editing: Editing; onClose: () => void; onDone: () => void }) {
  const { businessId } = useWork();
  const s = editing?.service;
  const [name, setName] = useState(s?.name ?? '');
  const [minutes, setMinutes] = useState(s?.durationMinutes ?? 30);
  const [price, setPrice] = useState(s ? String(s.price.amount) : '');
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});
  const [saving, setSaving] = useState(false);
  const durations = DURATIONS.includes(minutes) ? DURATIONS : [...DURATIONS, minutes].sort((a, b) => a - b);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Enter a name.';
    if (price === '') next.price = 'Enter a price (0 for free).';
    setErrors(next);
    if (Object.keys(next).length) return;
    const body: ServiceInput = { name: name.trim(), durationMinutes: minutes, price: { amount: Number(price), currency: 'KES' } };
    setSaving(true);
    try {
      if (s) {
        await api<Service>(`/businesses/${businessId}/services/${s.serviceId}`, { method: 'PATCH', body });
      } else {
        await api<Service>(`/businesses/${businessId}/services`, { method: 'POST', body: { ...body, categoryId: editing.categoryId } });
      }
      toast.success(s ? 'Service saved' : 'Service added');
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the service."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!editing}
      onClose={onClose}
      title={s ? 'Edit service' : 'New service'}
      locked={saving}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="service-form" loading={saving}>
            {s ? 'Save' : 'Add service'}
          </Button>
        </div>
      }
    >
      <form id="service-form" onSubmit={submit} className="flex flex-col gap-4 pb-2" noValidate>
        <Input label="Name" placeholder="e.g. Skin fade" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={100} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Duration" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {durations.map((d) => (
              <option key={d} value={d}>
                {duration(d)}
              </option>
            ))}
          </Select>
          <Input label="Price (KSh)" inputMode="numeric" value={price} onChange={(e) => setPrice(digitsOnly(e.target.value, 7))} error={errors.price} />
        </div>
      </form>
    </Modal>
  );
}
