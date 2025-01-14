import type { LinksFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import type { LoaderFunction } from "@remix-run/node";
import styles from './styles/index.css';

export const loader: LoaderFunction = async () => {
  return {
    gaTrackingId: process.env.GA_TRACKING_ID,
  };
};

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles }
];

export const meta = () => {
  return [
    { title: "Barron Wasteland" },
    { rel: "icon", href: "/favicon.ico" },
  ];
};

export default function App() {

  const { gaTrackingId } = useLoaderData<typeof loader>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaTrackingId}`} />
        <script
          async
          id="gtag-init"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaTrackingId}');
            `,
          }}
        />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}