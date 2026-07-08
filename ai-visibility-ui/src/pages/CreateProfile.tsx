import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProfile, ApiError } from '../services/api';
import { Card } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { TagInput } from '../components/ui/TagInput';

interface FormState {
  name: string;
  domain: string;
  industry: string;
  description: string;
}

const INITIAL_STATE: FormState = { name: '', domain: '', industry: '', description: '' };

export function CreateProfile() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setFieldErrors({});

    if (!form.name.trim() || !form.domain.trim() || !form.industry.trim()) {
      setFieldErrors({
        ...(!form.name.trim() && { name: ['Name is required.'] }),
        ...(!form.domain.trim() && { domain: ['Domain is required.'] }),
        ...(!form.industry.trim() && { industry: ['Industry is required.'] }),
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const profile = await createProfile({
        name: form.name.trim(),
        domain: form.domain.trim(),
        industry: form.industry.trim(),
        description: form.description.trim() || undefined,
        competitors,
      });
      navigate(`/profiles/${profile.profile_uuid}`);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.code === 'VALIDATION_ERROR' && apiErr.details) {
        setFieldErrors(apiErr.details as Record<string, string[]>);
      } else {
        setSubmitError(apiErr.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-2xl font-semibold text-ink dark:text-ink-dark">New Profile</h1>
      <p className="mt-1 text-sm text-muted dark:text-muted-dark">
        Register a business to start discovering how it appears in AI-generated answers.
      </p>

      <Card className="mt-5 p-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Field label="Business name" error={fieldErrors.name?.[0]}>
            <input
              type="text"
              value={form.name}
              onChange={updateField('name')}
              placeholder="Frase"
              className={inputClass(!!fieldErrors.name)}
            />
          </Field>

          <Field label="Domain" error={fieldErrors.domain?.[0]}>
            <input
              type="text"
              value={form.domain}
              onChange={updateField('domain')}
              placeholder="frase.io"
              className={inputClass(!!fieldErrors.domain)}
            />
          </Field>

          <Field label="Industry" error={fieldErrors.industry?.[0]}>
            <input
              type="text"
              value={form.industry}
              onChange={updateField('industry')}
              placeholder="SEO Content Tools"
              className={inputClass(!!fieldErrors.industry)}
            />
          </Field>

          <Field label="Description" error={fieldErrors.description?.[0]}>
            <textarea
              value={form.description}
              onChange={updateField('description')}
              placeholder="AI-powered content briefs and SEO research"
              rows={3}
              className={inputClass(false)}
            />
          </Field>

          <Field label="Competitors" hint="Press Enter or comma after each one">
            <TagInput values={competitors} onChange={setCompetitors} placeholder="surferseo.com" />
          </Field>

          {submitError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600 dark:bg-danger-500/10 dark:text-danger-500">
              {submitError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="submit" isLoading={isSubmitting}>
              Create Profile
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink dark:text-ink-dark">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted dark:text-muted-dark">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger-500">{error}</span>}
    </label>
  );
}

function inputClass(hasError: boolean) {
  return `w-full rounded-lg border px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-signal-500 dark:text-ink-dark dark:bg-surface-dark ${
    hasError ? 'border-danger-500' : 'border-border dark:border-border-dark'
  } bg-surface`;
}
