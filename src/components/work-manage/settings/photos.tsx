'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { Button, Spinner } from '@/components/ui/button';
import { Badge, EmptyState } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { useWork } from '@/components/work/context';
import { api, errorMessage } from '@/lib/api';
import type { BusinessPhoto } from '@/types/business';
import type { BusinessDetail } from '@/types/work-manage';
import { ConfirmModal } from '../shared';
import { SettingsSection } from './common';

const MAX_BYTES = 10 * 1024 * 1024; // the server's limit
const TYPES = ['image/jpeg', 'image/png'];

export function PhotosSettings() {
  return (
    <SettingsSection title="Photos" subtitle="The cover leads your profile and search results; the rest form your gallery.">
      {(b, reload) => <Photos business={b} reload={reload} />}
    </SettingsSection>
  );
}

function Photos({ business, reload }: { business: BusinessDetail; reload: () => void }) {
  const { businessId } = useWork();
  const input = useRef<HTMLInputElement>(null);
  const [asCover, setAsCover] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [removing, setRemoving] = useState<BusinessPhoto | null>(null);
  // Cover first, then the order they were added.
  const photos = [...(business.photos ?? [])].sort((a, b) => Number(b.isCover) - Number(a.isCover));

  // Through the API as multipart (POST /photos): same origin via the proxy, so
  // no storage CORS setup is needed, unlike mobile's presigned-URL upload.
  const upload = async (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    const ok = list.filter((f) => {
      if (!TYPES.includes(f.type)) {
        toast.error(`${f.name}: only JPEG or PNG photos.`);
        return false;
      }
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name} is over 10 MB.`);
        return false;
      }
      return true;
    });
    setUploading(ok.length);
    let done = 0;
    for (const [i, file] of ok.entries()) {
      const form = new FormData();
      form.append('photo', file);
      // Only the first file of a "new cover" upload becomes the cover.
      form.append('isCover', String(asCover && i === 0));
      try {
        await api<BusinessPhoto>(`/businesses/${businessId}/photos`, { method: 'POST', body: form });
        done += 1;
      } catch (err) {
        toast.error(errorMessage(err, `Couldn't upload ${file.name}.`));
      }
      setUploading((n) => n - 1);
    }
    if (done) toast.success(done === 1 ? 'Photo added' : `${done} photos added`);
    setAsCover(false);
    if (input.current) input.current.value = '';
    reload();
  };

  const pick = (cover: boolean) => {
    setAsCover(cover);
    input.current?.click();
  };

  return (
    <div className="flex flex-col gap-6">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        multiple
        className="sr-only"
        aria-label="Choose photos"
        onChange={(e) => upload(e.target.files)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => pick(false)} loading={uploading > 0} disabled={uploading > 0}>
          {uploading > 0 ? `Uploading ${uploading}…` : 'Add photos'}
        </Button>
        {photos.length ? (
          <Button variant="secondary" onClick={() => pick(true)} disabled={uploading > 0}>
            Upload a new cover
          </Button>
        ) : null}
        <p className="text-sm text-ink-2">JPEG or PNG, up to 10 MB each.</p>
      </div>

      {photos.length === 0 && uploading === 0 ? (
        <EmptyState title="No photos yet" body="Businesses with photos get far more bookings. Your first photo becomes the cover." action={<Button onClick={() => pick(false)}>Add photos</Button>} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {photos.map((p) => (
            <li key={p.photoId} className="group relative aspect-[4/3] overflow-hidden rounded-card bg-surface-3">
              <Image src={p.url} alt={p.isCover ? 'Cover photo' : 'Business photo'} fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 33vw, 50vw" className="object-cover" unoptimized />
              {p.isCover ? (
                <span className="absolute top-2 left-2">
                  <Badge tone="brand">Cover</Badge>
                </span>
              ) : null}
              <button
                onClick={() => setRemoving(p)}
                className="absolute top-2 right-2 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-danger shadow-card opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                aria-label={p.isCover ? 'Remove cover photo' : 'Remove photo'}
              >
                Remove
              </button>
            </li>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <li key={`up-${i}`} className="grid aspect-[4/3] place-items-center rounded-card border border-dashed border-line-2 text-ink-2">
              <Spinner />
            </li>
          ))}
        </ul>
      )}
      <ConfirmModal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Remove this photo?"
        body={removing?.isCover ? 'Your oldest remaining photo becomes the cover.' : 'It comes off your profile straight away.'}
        confirmLabel="Remove"
        danger
        onConfirm={async () => {
          if (!removing) return;
          try {
            await api(`/businesses/${businessId}/photos/${removing.photoId}`, { method: 'DELETE' });
            toast.success('Photo removed');
            setRemoving(null);
            reload();
          } catch (err) {
            toast.error(errorMessage(err, "Couldn't remove it."));
          }
        }}
      />
    </div>
  );
}
