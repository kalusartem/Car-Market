import { lazy, Suspense, useEffect } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "./components/SiteHeader";
import { SiteFooter } from "./components/SiteFooter";
import { NotFound } from "./components/NotFound";
import { takeReturnTo } from "./lib/auth";
import { supabase } from "./lib/supabase";
import { LoginPage } from "./features/auth/LoginPage";
import { MfaGate } from "./features/auth/MfaGate";
import { RequireAuth } from "./features/auth/RequireAuth";
import { HomePage } from "./features/listings/pages/HomePage";
import { ListingsPage } from "./features/listings/pages/ListingsPage";
import { ListingDetailsPage } from "./features/listings/pages/ListingDetailsPage";
import { PrivacyPage, TermsPage } from "./features/legal/LegalPages";

const CreateListingPage = lazy(() =>
  import("./features/listings/pages/CreateListingPage").then((m) => ({
    default: m.CreateListingPage,
  })),
);
const EditListingPage = lazy(() =>
  import("./features/listings/pages/EditListingPage").then((m) => ({
    default: m.EditListingPage,
  })),
);
const PriceCheckPage = lazy(() =>
  import("./features/listings/pages/PriceCheckPage").then((m) => ({
    default: m.PriceCheckPage,
  })),
);
const SellerPage = lazy(() =>
  import("./features/listings/pages/SellerPage").then((m) => ({
    default: m.SellerPage,
  })),
);
const FavoritesPage = lazy(() =>
  import("./features/favorites/pages/FavoritesPage").then((m) => ({
    default: m.FavoritesPage,
  })),
);
const AccountPage = lazy(() =>
  import("./features/account/pages/AccountPage").then((m) => ({
    default: m.AccountPage,
  })),
);
const MyListingsPage = lazy(() =>
  import("./features/account/pages/MyListingsPage").then((m) => ({
    default: m.MyListingsPage,
  })),
);
const ReviewListingsPage = lazy(() =>
  import("./features/admin/pages/ReviewListingsPage").then((m) => ({
    default: m.ReviewListingsPage,
  })),
);
const InboxPage = lazy(() =>
  import("./features/messages/pages/InboxPage").then((m) => ({
    default: m.InboxPage,
  })),
);
const MessageThreadPage = lazy(() =>
  import("./features/messages/pages/MessageThreadPage").then((m) => ({
    default: m.MessageThreadPage,
  })),
);

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

/** Keeps cached data in step with sign-in/out and returns people to where they were. */
function AuthEvents() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED"
      ) {
        qc.invalidateQueries();
      }
      if (event === "SIGNED_IN") {
        const back = takeReturnTo();
        if (back) navigate(back, { replace: true });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [qc, navigate]);

  return null;
}

const guard = (el: React.ReactNode) => <RequireAuth>{el}</RequireAuth>;

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-fg"
      >
        Skip to content
      </a>
      <AuthEvents />
      <ScrollToTop />
      <SiteHeader />

      <div id="main" className="flex-1">
        <MfaGate>
          <Suspense
            fallback={
              <div className="mx-auto max-w-3xl px-6 py-16 text-center text-subtle">
                Loading…
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/listings" element={<ListingsPage />} />
              <Route path="/cars/:make" element={<ListingsPage />} />
              <Route path="/cars/:make/:model" element={<ListingsPage />} />
              <Route path="/listings/:id" element={<ListingDetailsPage />} />
              <Route path="/price-check" element={<PriceCheckPage />} />
              <Route path="/sellers/:id" element={<SellerPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />

              <Route path="/sell" element={guard(<CreateListingPage />)} />
              <Route
                path="/listings/:id/edit"
                element={guard(<EditListingPage />)}
              />
              <Route path="/favorites" element={guard(<FavoritesPage />)} />
              <Route path="/account" element={guard(<AccountPage />)} />
              <Route
                path="/account/listings"
                element={guard(<MyListingsPage />)}
              />
              <Route path="/admin" element={guard(<ReviewListingsPage />)} />
              <Route path="/messages" element={guard(<InboxPage />)} />
              <Route
                path="/messages/:listingId/:buyerId"
                element={guard(<MessageThreadPage />)}
              />
              <Route
                path="/inbox"
                element={<Navigate to="/messages" replace />}
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </MfaGate>
      </div>

      <SiteFooter />
    </div>
  );
}
