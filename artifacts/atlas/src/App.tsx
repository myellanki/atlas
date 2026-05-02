import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Board from "@/pages/board";
import Gantt from "@/pages/gantt";
import Labels from "@/pages/labels";
import Settings from "@/pages/settings";
import Calendar from "@/pages/calendar";
import Projects from "@/pages/projects";
import Milestones from "@/pages/milestones";
import Templates from "@/pages/templates";
import Portfolio from "@/pages/portfolio";
import Capacity from "@/pages/capacity";
import Publications from "@/pages/publications";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/projects" component={Projects} />
      <Route path="/board/:teamSlug" component={Board} />
      <Route path="/gantt/:teamId" component={Gantt} />
      <Route path="/labels" component={Labels} />
      <Route path="/settings" component={Settings} />
      <Route path="/milestones" component={Milestones} />
      <Route path="/templates" component={Templates} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/capacity" component={Capacity} />
      <Route path="/publications" component={Publications} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <Layout>
            <Router />
          </Layout>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
