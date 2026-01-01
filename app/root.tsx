import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Error";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "Page Not Found" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <div className="max-w-240 mx-auto px-5 py-5">
      <header className="border-b-[3px] border-theme-navy-700 pb-4 mb-6">
        <h1 className="font-serif text-[2rem] font-normal text-theme-navy-900 m-0 mb-2.5">
          {message}
        </h1>
      </header>

      <div className="bg-gray-50 border border-gray-300 p-5 mb-8">
        <p className="text-sm text-gray-700 m-0">{details}</p>
      </div>

      {stack && (
        <div className="bg-gray-50 border border-gray-300 p-5">
          <pre className="text-xs overflow-x-auto m-0">
            <code>{stack}</code>
          </pre>
        </div>
      )}

      <nav className="mt-6">
        <a href="/" className="text-theme-navy-700 underline text-sm">
          Return to home page
        </a>
      </nav>
    </div>
  );
}
