'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useRegisterMutation } from '@/store/api/authApi';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '@/store/slices/authSlice';
import { getErrorMessage } from '@/lib/types';
import { Alert } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';

export default function RegisterPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [register, { isLoading, error }] = useRegisterMutation();
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await register(form).unwrap();
      dispatch(setCredentials(result));
      router.push('/dashboard');
    } catch {
      // Rendered through the mutation error below.
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="eyebrow hover:text-ink">
        ← Digital Archaeologist
      </Link>
      <h1 className="mt-8 font-display text-4xl">Open a field record</h1>
      <p className="mt-2 text-sm text-ink-soft">
        An account is required before importing or analysing repositories.
      </p>

      <form onSubmit={(event) => void submit(event)} className="mt-8 space-y-5">
        {error ? <Alert>{getErrorMessage(error)}</Alert> : null}
        <Field
          label="Full name"
          autoComplete="name"
          required
          minLength={2}
          value={form.fullName}
          onChange={(event) => setForm({ ...form, fullName: event.target.value })}
        />
        <Field
          label="Email address"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="At least 8 characters, including a letter and a number."
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Creating record…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-soft">
        Already registered?{' '}
        <Link href="/login" className="text-clay hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
