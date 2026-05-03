// @ts-nocheck — migrated in Step 2/7/8
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import FileBrowser from '@/pages/FileBrowser';

export default function App() {
  return (
    <Authenticator>
      {() => (
        <TooltipProvider delay={300}>
          <FileBrowser />
        </TooltipProvider>
      )}
    </Authenticator>
  );
}
