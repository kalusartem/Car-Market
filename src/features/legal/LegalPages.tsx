import { Link } from "react-router-dom";
import { usePageMeta } from "../../hooks/usePageMeta";

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  usePageMeta({ title });
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-subtle">Last updated November 15, 2026</p>
      <div className="mt-6 space-y-4 text-muted [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-fg [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </main>
  );
}

function Contact() {
  return (
    <Link to="/contact" className="underline">
      contact form
    </Link>
  );
}

// Plain-language text written to match what the app does. It has not been reviewed by a lawyer; get it
// reviewed before relying on it for a public launch.

export function TermsPage() {
  return (
    <Page title="Terms of use">
      <p>
        Car Market is operated by Mokahub LLC (“we”, “us”). It lets private sellers advertise used vehicles
        and lets buyers contact them. We are not a party to any sale, we do not inspect vehicles, verify sellers, or
        handle payments or transfers of title. By using the site you agree to these terms.
      </p>
      <h2>Your account</h2>
      <p>
        You sign in with Google, GitHub or an email link, and may add two-step verification. You must be at
        least 18 and are responsible for activity on your account and for keeping it secure.
      </p>
      <h2>Listing a car</h2>
      <ul>
        <li>Only list vehicles you own or are authorized to sell, with accurate details, price and photos.</li>
        <li>Only upload photos you have the right to use. You keep ownership of them and give us permission to display them on the site.</li>
        <li>Do not post scams, stolen or salvage-concealed vehicles, misleading prices, other people’s photos, or anything unlawful.</li>
        <li>New and edited listings may be reviewed before they appear. We may reject, hide or remove any listing, and suspend accounts that break these rules, with or without notice.</li>
        <li>Users can report listings. Abuse of messaging or reporting (spam, harassment) is not allowed.</li>
      </ul>
      <h2>Buying a car</h2>
      <p>
        Verify the vehicle, its VIN, history and title yourself, and have it inspected. Meet in a public place,
        and never send money for a car you have not seen. Recall data, VIN decoding and price checks are
        informational only and may be incomplete or wrong.
      </p>
      <h2>Messages</h2>
      <p>
        Messages you send are delivered to the seller inside the site. Do not share sensitive information
        such as bank details in them.
      </p>
      <h2>No warranty and limited liability</h2>
      <p>
        The service is provided “as is” and “as available”, without warranties of any kind, and may change or be
        unavailable at times. To the fullest extent allowed by law, we are not liable for vehicles, listings,
        transactions or disputes between users, or for indirect or consequential losses. Nothing here limits
        rights you have under law that cannot be waived.
      </p>
      <h2>Changes and contact</h2>
      <p>
        We may update these terms; continuing to use the site means you accept the updated version. Questions
        or takedown requests: use the <Contact />.
      </p>
    </Page>
  );
}

export function PrivacyPage() {
  return (
    <Page title="Privacy policy">
      <p>
        This page explains what Car Market, operated by Mokahub LLC, collects, why, and who it is shared with.
        Mokahub LLC is the controller of this data.
      </p>
      <h2>What we store</h2>
      <ul>
        <li>Account details from your sign-in provider (Google, GitHub or email): email address, name and profile picture.</li>
        <li>Listings you create, including photos, price, VIN, ZIP code and the approximate location derived from it. Listings are public once approved.</li>
        <li>Messages you send to sellers and receive from buyers (visible to you and the other party), cars you save, and reports you file.</li>
        <li>If you turn on two-step verification, the authenticator enrollment is held by our sign-in provider.</li>
      </ul>
      <h2>How we use it</h2>
      <p>
        To run the marketplace: show listings, deliver messages, review listings for quality and safety, and
        prevent abuse. When you submit a listing, an email notification containing its details is sent to the
        site administrator for review. We do not sell your data and show no advertising.
      </p>
      <h2>Who processes it</h2>
      <ul>
        <li>Supabase — hosts our database, file storage and sign-in.</li>
        <li>Cloudflare — hosts the site and its server functions, and sees standard request data such as your IP address.</li>
        <li>An email delivery provider — sends administrator notifications about new listings.</li>
        <li>Google and GitHub — if you choose them to sign in, under their own privacy policies.</li>
      </ul>
      <h2>Services we call from your browser</h2>
      <ul>
        <li>NHTSA (vehicle makes, models, VIN decoding, recalls) — receives the make, model, year or VIN you look up.</li>
        <li>Zippopotam.us — receives a ZIP code to convert it to coordinates.</li>
      </ul>
      <h2>Local storage and cookies</h2>
      <p>
        We store your sign-in session, theme choice, a cache of vehicle lookups and your last ZIP code in your
        browser, and briefly remember the page to return to after signing in. These are needed for the site
        to work. We do not use advertising or tracking cookies.
      </p>
      <h2>Your choices and retention</h2>
      <p>
        You can hide or delete your listings and saved cars at any time. We keep your data while your account
        is active. To access, correct or delete your account and data, send us a message through the <Contact /> from the address you
        signed up with and we will act on it. Copies in backups may persist for a short time.
      </p>
      <h2>Children</h2>
      <p>The site is not for anyone under 18, and we do not knowingly collect their data.</p>
      <h2>Changes and contact</h2>
      <p>
        We will update the date above when this policy changes. Questions: use the <Contact />.
      </p>
    </Page>
  );
}
