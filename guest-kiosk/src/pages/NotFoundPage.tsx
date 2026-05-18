import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-8 text-center text-foreground">
      <div className="max-w-xl space-y-4">
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="text-foreground/60">
          The guest kiosk page you requested does not exist in this build.
        </p>
        <Link
          to="/"
          className="inline-flex rounded-full border border-foreground/10 px-5 py-2 text-sm font-medium"
        >
          Return home
        </Link>
      </div>
    </div>
  );
}
