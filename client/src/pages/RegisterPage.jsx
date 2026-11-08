import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField, inputClassName } from '../components/ui/FormField';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

const registerFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Display name must be at least 2 characters.')
    .max(80, 'Display name cannot exceed 80 characters.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.'),
});

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/trips';
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      await registerUser(values);
      toast.success('Account created', 'Welcome to TripSplit Planner!');
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setServerError(err.message || 'Registration failed.');
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card className="overflow-hidden">
        <div
          aria-hidden="true"
          className="h-1.5 w-full bg-gradient-to-r from-[#0F766E] via-sunshine to-coral"
        />
        <div className="p-6 sm:p-8">
          <div className="mb-6 space-y-1">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#E9F5F3] text-[#0F766E] border border-[#BEE3DD] mb-2">
              <UserPlus className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-extrabold text-ink">Create your account</h1>
            <p className="text-sm text-ink-body">
              Start planning trips and splitting shared expenses with your group.
            </p>
          </div>

          {serverError ? (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800"
            >
              {serverError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <FormField
              label="Full Name / Display Name"
              htmlFor="register-displayName"
              required
              error={errors.displayName?.message}
            >
              <input
                id="register-displayName"
                type="text"
                autoComplete="name"
                placeholder="e.g. Aarav Sharma"
                className={inputClassName}
                {...register('displayName')}
              />
            </FormField>

            <FormField
              label="Email Address"
              htmlFor="register-email"
              required
              error={errors.email?.message}
            >
              <input
                id="register-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={inputClassName}
                {...register('email')}
              />
            </FormField>

            <FormField
              label="Password"
              htmlFor="register-password"
              required
              hint="At least 8 characters with 1 letter and 1 number."
              error={errors.password?.message}
            >
              <input
                id="register-password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className={inputClassName}
                {...register('password')}
              />
            </FormField>

            <Button type="submit" disabled={isSubmitting} className="w-full py-2.5">
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-ink-body">
            Already have an account?{' '}
            <Link
              to={
                redirectTo !== '/trips'
                  ? `/login?redirect=${encodeURIComponent(redirectTo)}`
                  : '/login'
              }
              className="font-semibold text-[#0F766E] hover:underline"
            >
              Log in here
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}

