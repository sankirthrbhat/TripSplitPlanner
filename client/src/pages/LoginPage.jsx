import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField, inputClassName } from '../components/ui/FormField';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

const loginFormSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

const DEMO_ACCOUNTS = [
  { name: 'Aarav (Owner)', email: 'aarav@tripsplit.demo' },
  { name: 'Diya (Member)', email: 'diya@tripsplit.demo' },
  { name: 'Kabir (Member)', email: 'kabir@tripsplit.demo' },
  { name: 'Meera (Member)', email: 'meera@tripsplit.demo' },
];

export function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/trips';
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      await login(values);
      toast.success('Welcome back', 'Signed in successfully.');
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setServerError(err.message || 'Invalid credentials.');
    }
  };

  const fillDemoAccount = (email) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', 'DemoPassword123', { shouldValidate: true });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card className="p-6 sm:p-8">
        <div className="mb-6 space-y-1">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 border border-teal-200 mb-2">
            <LogIn className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold text-navy-900">Sign in to TripSplit</h1>
          <p className="text-sm text-slate-600">
            Access your collaborative trip workspaces and expense ledgers.
          </p>
        </div>

        {serverError ? (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800"
          >
            {serverError}
          </div>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormField
            label="Email Address"
            htmlFor="login-email"
            required
            error={errors.email?.message}
          >
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className={inputClassName}
              {...register('email')}
            />
          </FormField>

          <FormField
            label="Password"
            htmlFor="login-password"
            required
            error={errors.password?.message}
          >
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className={inputClassName}
              {...register('password')}
            />
          </FormField>

          <Button type="submit" disabled={isSubmitting} className="w-full py-2.5">
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium text-slate-500 mb-2">
            Demo Evaluation Quick-Fill (after running <code className="font-mono">npm run seed:demo</code>):
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {DEMO_ACCOUNTS.map((acct) => (
              <button
                key={acct.email}
                type="button"
                onClick={() => fillDemoAccount(acct.email)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-900 transition-colors"
              >
                {acct.name}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          New to TripSplit Planner?{' '}
          <Link
            to={
              redirectTo !== '/trips'
                ? `/register?redirect=${encodeURIComponent(redirectTo)}`
                : '/register'
            }
            className="font-semibold text-teal-700 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </Card>
    </div>
  );
}

