import { useEffect, useState, type ReactNode } from 'react';
import type { Coin, Currency } from '../../domain/types';
import { CURRENCIES, METALS } from '../../domain/types';
import { newCoinId, validateCoin } from '../../domain/validate';
import { GRAMS_PER_TROY_OZ } from '../../domain/valuation';
import { useCoins } from '../../hooks/useCoins';
import { coinThumb } from '../../lib/coinFace';
import { PhotoCropper } from './PhotoCropper';
import { num } from '../../lib/format';
import { navigate } from '../../hooks/useRoute';
import { Button, Modal } from '../ui/primitives';

/** Form state keeps raw strings so people can type freely; parsed on save. */
type Draft = Record<keyof Coin, string>;

const FIELDS: (keyof Coin)[] = [
  'id', 'name', 'country', 'year', 'mint', 'denomination', 'metal', 'purity', 'grossWeightGrams', 'quantity',
  'purchasePricePerCoin', 'purchaseCurrency', 'purchaseDate', 'collectorValuePerCoin', 'notes', 'obverseImage',
  'reverseImage', 'diameterMm', 'thicknessMm', 'mintage', 'grade',
];

function toDraft(coin: Coin | null, currency: Currency): Draft {
  const d = Object.fromEntries(FIELDS.map((f) => [f, ''])) as Draft;
  if (!coin) {
    return { ...d, id: newCoinId(), metal: 'silver', purity: '0.999', quantity: '1', purchaseCurrency: currency, country: 'Netherlands' };
  }
  for (const f of FIELDS) {
    const v = coin[f];
    d[f] = v == null ? '' : String(v);
  }
  return d;
}

const optNum = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));
const optStr = (s: string) => (s.trim() === '' ? undefined : s.trim());

/** Accepts "0.900", "900" or "90%" for purity. */
export function parsePurity(s: string): number {
  const raw = s.trim().replace(',', '.');
  const n = Number(raw.replace('%', ''));
  if (raw.endsWith('%')) return n / 100;
  return n > 1 ? n / 1000 : n;
}

function fromDraft(d: Draft): Partial<Coin> {
  const coin: Partial<Coin> = {
    id: d.id,
    name: d.name.trim(),
    country: d.country.trim(),
    year: optNum(d.year) ?? null,
    mint: optStr(d.mint),
    denomination: d.denomination.trim(),
    metal: d.metal as Coin['metal'],
    purity: parsePurity(d.purity),
    grossWeightGrams: optNum(d.grossWeightGrams) ?? NaN,
    quantity: optNum(d.quantity) ?? NaN,
    purchasePricePerCoin: optNum(d.purchasePricePerCoin) ?? 0,
    purchaseCurrency: d.purchaseCurrency as Currency,
    purchaseDate: optStr(d.purchaseDate),
    collectorValuePerCoin: optNum(d.collectorValuePerCoin),
    notes: optStr(d.notes),
    obverseImage: optStr(d.obverseImage),
    reverseImage: optStr(d.reverseImage),
    diameterMm: optNum(d.diameterMm),
    thicknessMm: optNum(d.thicknessMm),
    mintage: optNum(d.mintage),
    grade: optStr(d.grade),
  };
  // Drop empty optional fields so coins.json stays tidy.
  for (const k of Object.keys(coin) as (keyof Coin)[]) if (coin[k] === undefined) delete coin[k];
  return coin;
}

/** Enough of a coin to draw a placeholder preview from the form. */
function previewCoin(d: Draft): Coin {
  return { ...(fromDraft(d) as Coin), metal: (d.metal as Coin['metal']) || 'silver', grossWeightGrams: optNum(d.grossWeightGrams) ?? 0, purity: parsePurity(d.purity) || 0 };
}

const inputCls =
  'h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-faint focus:outline-none focus-visible:border-gold';

/** Label + control. `htmlFor` must match the control's id (see `fid`). */
function Field({ label, htmlFor, children, hint, className }: { label: string; htmlFor: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-faint">
        {label}
      </label>
      {children}
      {hint && <span id={`${htmlFor}-hint`} className="mt-1 block text-xs text-faint">{hint}</span>}
    </div>
  );
}

const fid = (k: keyof Coin) => `coin-${k}`;

export function CoinForm({
  coin,
  open,
  onClose,
  onDeleted,
  currency,
}: {
  coin: Coin | null;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
  currency: Currency;
}) {
  const { upsert, remove } = useCoins();
  const [d, setD] = useState<Draft>(() => toDraft(coin, currency));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setD(toDraft(coin, currency));
      setErrors([]);
      setConfirmDelete(false);
    }
  }, [open, coin, currency]);

  const set = (k: keyof Coin) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));
  const text = (k: keyof Coin, props: Record<string, unknown> = {}) => <input id={fid(k)} className={inputCls} value={d[k]} onChange={set(k)} {...props} />;
  const number = (k: keyof Coin, props: Record<string, unknown> = {}) => text(k, { inputMode: 'decimal', ...props });

  const purity = parsePurity(d.purity);
  const weight = optNum(d.grossWeightGrams) ?? 0;
  const pureG = Number.isFinite(purity) ? weight * purity : 0;

  // Photo being cropped: which side, and the image to crop (object URL or data URL).
  const [cropping, setCropping] = useState<{ side: 'obverseImage' | 'reverseImage'; src: string } | null>(null);

  function onImage(side: 'obverseImage' | 'reverseImage', file?: File) {
    if (!file) return;
    setCropping({ side, src: URL.createObjectURL(file) });
  }

  function endCrop(dataUrl?: string) {
    if (cropping?.src.startsWith('blob:')) URL.revokeObjectURL(cropping.src);
    if (dataUrl && cropping) setD((x) => ({ ...x, [cropping.side]: dataUrl }));
    setCropping(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = fromDraft(d);
    const problems = validateCoin(parsed);
    setErrors(problems);
    if (problems.length) return;
    setSaving(true);
    try {
      await upsert(parsed as Coin);
      onClose();
      if (!coin) navigate({ name: 'coin', id: parsed.id! });
    } catch (err) {
      setErrors([err instanceof Error ? err.message : String(err)]);
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!coin) return;
    setSaving(true);
    try {
      await remove(coin.id);
      onClose();
      onDeleted();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : String(err)]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={coin ? `Edit ${coin.name}` : 'Add a coin'} wide>
      <form onSubmit={submit} noValidate className="space-y-6">
        {errors.length > 0 && (
          <ul role="alert" className="rounded-2xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-down">
            {errors.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 font-display text-lg font-semibold">Coin</legend>
          <Field htmlFor={fid('name')} label="Name" className="sm:col-span-2">{text('name', { required: true, placeholder: 'e.g. Rijksdaalder Wilhelmina', autoFocus: true })}</Field>
          <Field htmlFor={fid('country')} label="Country">{text('country', { required: true, list: 'mc-countries' })}</Field>
          <Field htmlFor={fid('year')} label="Year">{number('year', { inputMode: 'numeric', placeholder: '1938' })}</Field>
          <Field htmlFor={fid('denomination')} label="Denomination">{text('denomination', { placeholder: '2½ gulden' })}</Field>
          <Field htmlFor={fid('mint')} label="Mint">{text('mint', { placeholder: 'Utrecht' })}</Field>
          <Field htmlFor={fid('grade')} label="Grade / condition">{text('grade', { placeholder: 'VF, UNC, BU…' })}</Field>
          <Field htmlFor={fid('mintage')} label="Mintage">{number('mintage', { inputMode: 'numeric' })}</Field>
          <datalist id="mc-countries">
            {['Netherlands', 'United States', 'Canada', 'Austria', 'United Kingdom', 'Australia', 'South Africa', 'China', 'Mexico'].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="mb-3 font-display text-lg font-semibold">Metal</legend>
          <Field htmlFor={fid('metal')} label="Metal">
            <select id={fid('metal')} className={inputCls} value={d.metal} onChange={set('metal')}>
              {METALS.map((m) => (
                <option key={m} value={m}>
                  {m[0].toUpperCase() + m.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field htmlFor={fid('purity')} label="Purity" hint="0.720, 720 or 72%">{number('purity', { required: true })}</Field>
          <Field htmlFor={fid('grossWeightGrams')} label="Gross weight (g)">{number('grossWeightGrams', { required: true, placeholder: '25' })}</Field>
          <Field htmlFor={fid('diameterMm')} label="Diameter (mm)">{number('diameterMm')}</Field>
          <Field htmlFor={fid('thicknessMm')} label="Thickness (mm)">{number('thicknessMm')}</Field>
          <div className="self-end rounded-xl bg-surface-2 px-3 py-2 text-xs leading-5" aria-live="polite">
            <span className="text-faint">Pure content </span>
            <span className="font-semibold">
              {num(pureG, 2)} g · {num(pureG / GRAMS_PER_TROY_OZ, 4)} oz t
            </span>
          </div>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="mb-3 font-display text-lg font-semibold">Purchase</legend>
          <Field htmlFor={fid('quantity')} label="Quantity">{number('quantity', { inputMode: 'numeric', required: true })}</Field>
          <Field htmlFor={fid('purchasePricePerCoin')} label="Price per coin">{number('purchasePricePerCoin', { placeholder: '0.00' })}</Field>
          <Field htmlFor={fid('purchaseCurrency')} label="Currency">
            <select id={fid('purchaseCurrency')} className={inputCls} value={d.purchaseCurrency} onChange={set('purchaseCurrency')}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field htmlFor={fid('purchaseDate')} label="Purchase date">{text('purchaseDate', { type: 'date' })}</Field>
          <Field htmlFor={fid('collectorValuePerCoin')} label="Collector value per coin" hint="Optional. Leave empty to use melt value." className="sm:col-span-2">
            {number('collectorValuePerCoin', { placeholder: 'e.g. 45.00' })}
          </Field>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-1 font-display text-lg font-semibold">Photos</legend>
          <p className="text-sm text-muted sm:col-span-2">
            Take a photo of each side straight from above, on a plain background. You'll crop the coin into a circle next.
          </p>
          {(['obverseImage', 'reverseImage'] as const).map((side) => {
            const label = side === 'obverseImage' ? 'Front (obverse)' : 'Back (reverse)';
            const preview = d[side] || (d.name ? coinThumb(previewCoin(d), side === 'obverseImage' ? 'obverse' : 'reverse', 160) : '');
            return (
              <div key={side} className="rounded-2xl border border-line bg-surface-2 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-faint">{label}</p>
                <div className="mt-3 flex items-center gap-4">
                  {preview ? (
                    <img src={preview} alt="" className="size-20 shrink-0 rounded-full object-cover shadow-card" />
                  ) : (
                    <span className="size-20 shrink-0 rounded-full border border-dashed border-line" aria-hidden />
                  )}
                  <div className="flex flex-wrap gap-2">
                    <span className="relative inline-flex">
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 cursor-pointer opacity-0"
                        aria-label={`Choose or take a photo of the ${label.toLowerCase()}`}
                        onChange={(e) => {
                          onImage(side, e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                      <span className="inline-flex h-9 items-center rounded-full border border-line bg-surface px-3 text-sm font-semibold">
                        {d[side] ? 'New photo' : 'Add photo'}
                      </span>
                    </span>
                    {d[side].startsWith('data:') && (
                      <Button type="button" className="h-9 px-3" onClick={() => setCropping({ side, src: d[side] })}>
                        Adjust
                      </Button>
                    )}
                    {d[side] && (
                      <Button type="button" variant="quiet" className="h-9 px-3" onClick={() => setD((x) => ({ ...x, [side]: '' }))}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
                {!d[side].startsWith('data:') && (
                  <div className="mt-3">
                    <label htmlFor={fid(side)} className="text-xs text-faint">
                      Or paste an image link
                    </label>
                    {text(side, { placeholder: 'https://…', type: 'url', className: `${inputCls} mt-1 h-9` })}
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>

        <Field htmlFor={fid('notes')} label="Notes">
          <textarea id={fid('notes')} className={`${inputCls} h-24 py-2`} value={d.notes} onChange={set('notes')} />
        </Field>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          {coin &&
            (confirmDelete ? (
              <span className="flex items-center gap-2 text-sm">
                Delete this coin for good?
                <Button type="button" variant="danger" onClick={doDelete} disabled={saving}>
                  Yes, delete
                </Button>
                <Button type="button" variant="quiet" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
              </span>
            ) : (
              <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            ))}
          <span className="flex-1" />
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : coin ? 'Save changes' : 'Add coin'}
          </Button>
        </div>
      </form>
      <PhotoCropper
        src={cropping?.src ?? null}
        title={cropping?.side === 'reverseImage' ? 'Crop the back' : 'Crop the front'}
        onCancel={() => endCrop()}
        onDone={(url) => endCrop(url)}
      />
    </Modal>
  );
}
