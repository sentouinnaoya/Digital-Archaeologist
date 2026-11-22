'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useLoginMutation } from '@/store/api/authApi';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '@/store/slices/authSlice';
import { getErrorMessage } from '@/lib/types';
import { Alert } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [login, { isLoading, error }] = useLoginMutation();
  const [form, setForm] = useState({ email: '', password: '' });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await login(form).unwrap();
      dispatch(setCredentials(result));
      router.push('/dashboard');
    } catch {
      // The mutation exposes a structured error, rendered below.
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="eyebrow hover:text-ink">
        ← Digital Archaeologist
      </Link>
      <h1 className="mt-8 font-display text-4xl">Return to the archive</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Authenticate to continue your excavation.
      </p>

      <form onSubmit={(event) => void submit(event)} className="mt-8 space-y-5">
        {error ? <Alert>{getErrorMessage(error)}</Alert> : null}
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
          autoComplete="current-password"
          required
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Verifying…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-soft">
        No field record yet?{' '}
        <Link href="/register" className="text-clay hover:underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}
