import { Routes, Route } from 'react-router-dom';
import { SignIn, SignUp, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import FileBrowser from '@/pages/FileBrowser';

export default function App() {
  return (
    <TooltipProvider delay={300}>
      <Routes>
        <Route
          path="/sign-in/*"
          element={<SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />}
        />
        <Route
          path="/sign-up/*"
          element={<SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />}
        />
        <Route
          path="/*"
          element={
            <>
              <SignedIn>
                <FileBrowser />
              </SignedIn>
              <SignedOut>
                <RedirectToSignIn />
              </SignedOut>
            </>
          }
        />
      </Routes>
    </TooltipProvider>
  );
}
