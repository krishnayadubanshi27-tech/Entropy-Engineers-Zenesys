import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  FileText,
  ListChecks,
  Mail,
  PenLine,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { CategoryBars, ImpactPie, RiskGauge } from "@/components/charts";
import { ChatPanel } from "@/components/ChatPanel";
import { Badge, Button, Card } from "@/components/ui";
import { formatBytes, formatDate } from "@/lib/format";
import { aiService } from "@/services/ai";
import { contractStore, useContracts, useWorkspaces } from "@/services/store";
import {
  QUICK_ACTIONS,
  QUICK_ACTION_LABELS,
  type ComplianceItem,
  type QuickAction,
} from "@/services/types";

export const Route = createFileRoute("/_authenticated/contract/$id")({
  head: () => ({
    meta: [
      { title: "Contract Analysis — EnContract" },
      {
        name: "description",
        content:
          "AI contract analysis: risk score, clause charts, compliance checklist, deadlines, and an AI assistant that has read the document.",
      },
      { property: "og:title", content: "Contract Analysis — EnContract" },
      {
        property: "og:description",
        content:
          "AI contract analysis: risk score, clause charts, compliance checklist, deadlines, and an AI assistant that has read the document.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContractPage,
});

const ACTION_ICONS: Record<QuickAction, typeof Mail> = {
  nda_sent: Mail,
  sign_pending: PenLine,
  renewal_pending: CalendarClock,
};

function complianceIcon(status: ComplianceItem["status"]) {
  if (status === "pass") return <CheckCircle2 className="size-4 shrink-0 text-positive" />;
  if (status === "attention") return <CircleAlert className="size-4 shrink-0 text-neutral-chart" />;
  return <TriangleAlert className="size-4 shrink-0 text-risk" />;
}

function ContractPage() {
  const { id } = Route.useParams();
  const contracts = useContracts();
  const workspaces = useWorkspaces();
  const contract = contracts.find((c) => c.id === id);
  const workspace = contract ? workspaces.find((w) => w.id === contract.workspaceId) : undefined;

  const runningRef = useRef(false);
  const [step, setStep] = useState<"extract" | "analyze">("extract");

  // Kick off analysis for contracts that have none yet.
  useEffect(() => {
    if (!contract || contract.analysis || contract.status === "analysis_failed") return;
    if (runningRef.current) return;
    runningRef.current = true;

    const run = async () => {
      contractStore.setContractStatus(id, "analyzing");
      try {
        setStep("extract");
        let text = contract.text;
        if (!text) {
          const blob = await contractStore.getContractFile(id);
          if (!blob) throw new Error("The uploaded PDF could not be found in local storage.");
          text = await aiService.extractText(blob);
          contractStore.setContractText(id, text);
        }
        setStep("analyze");
        const analysis = await aiService.analyze(contract.title, text);
        contractStore.setContractAnalysis(id, {
          ...analysis,
          analyzedAt: new Date().toISOString(),
        });
        toast.success("Analysis complete.");
      } catch (error) {
        contractStore.setContractStatus(id, "analysis_failed");
        toast.error(error instanceof Error ? error.message : "Analysis failed.");
      } finally {
        runningRef.current = false;
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, contract?.status, contract?.analysis]);

  if (!contract) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <h1 className="font-display text-2xl font-bold text-foreground">Contract not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have been removed, or it belongs to a different browser session.
          </p>
          <Link to="/dashboard" className="mt-6 inline-block">
            <Button variant="outline">
              <ArrowLeft className="size-4" />
              Back to workspaces
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  const retry = () => {
    contractStore.setContractStatus(id, "uploaded");
  };

  const markAction = (action: QuickAction) => {
    contractStore.markAction(id, action);
    toast.success(`Marked: ${QUICK_ACTION_LABELS[action]}`);
  };

  const takenActions = Object.keys(contract.actions) as QuickAction[];
  const analysis = contract.analysis;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Link
          to="/workspace/$id"
          params={{ id: contract.workspaceId }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {workspace?.name ?? "Workspace"}
        </Link>

        {/* Title + quick actions */}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {contract.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatBytes(contract.size)} · added {formatDate(contract.createdAt)}
              {analysis && ` · analyzed ${formatDate(analysis.analyzedAt)}`}
            </p>
            {takenActions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {takenActions.map((a) => (
                  <Badge key={a} tone="positive">
                    {QUICK_ACTION_LABELS[a]} · {formatDate(contract.actions[a]!)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((qa) => {
              const Icon = ACTION_ICONS[qa.id];
              const taken = !!contract.actions[qa.id];
              return (
                <Button
                  key={qa.id}
                  variant={taken ? "ghost" : "outline"}
                  disabled={taken}
                  onClick={() => markAction(qa.id)}
                  className={taken ? "text-positive" : undefined}
                >
                  <Icon className="size-4" />
                  {taken ? QUICK_ACTION_LABELS[qa.id] : qa.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        {contract.status === "analyzing" || (contract.status === "uploaded" && !analysis) ? (
          <Card className="mt-8 flex flex-col items-center gap-4 py-16 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/25 animate-glow-pulse">
              <FileSearch className="size-7" />
            </span>
            <h2 className="font-display text-lg font-semibold text-foreground">
              {step === "extract" ? "Extracting text from your PDF…" : "AI is reading the contract…"}
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {step === "extract"
                ? "Pulling every clause out of the document."
                : "Classifying clauses, checking compliance, and extracting deadlines. Usually under a minute."}
            </p>
            <div className="h-1.5 w-56 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: step === "extract" ? "35%" : "75%" }}
              />
            </div>
          </Card>
        ) : contract.status === "analysis_failed" ? (
          <Card className="mt-8 flex flex-col items-center gap-4 py-16 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-risk/12 text-risk ring-1 ring-risk/25">
              <TriangleAlert className="size-7" />
            </span>
            <h2 className="font-display text-lg font-semibold text-foreground">
              The analysis didn't complete
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              This can happen with scanned-only PDFs or a temporary AI hiccup. Your file is safe —
              try again.
            </p>
            <Button onClick={retry}>
              <RefreshCw className="size-4" />
              Retry analysis
            </Button>
          </Card>
        ) : analysis ? (
          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_360px]">
            {/* Bento analysis grid */}
            <div className="grid content-start gap-5 sm:grid-cols-2">
              <Card className="sm:col-span-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Summary
                  </h2>
                </div>
                <p className="mt-3 leading-relaxed text-foreground">{analysis.summary}</p>
              </Card>

              <Card>
                <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Risk score
                </h2>
                <div className="mt-4">
                  <RiskGauge score={analysis.riskScore} />
                </div>
              </Card>

              <Card>
                <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Clause impact split
                </h2>
                <div className="mt-2">
                  <ImpactPie clauses={analysis.clauses} />
                </div>
              </Card>

              <Card className="sm:col-span-2">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Positive vs. risk clauses by category
                </h2>
                <div className="mt-2">
                  <CategoryBars clauses={analysis.clauses} />
                </div>
              </Card>

              <Card>
                <div className="flex items-center gap-2">
                  <ListChecks className="size-4 text-primary" />
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Compliance checklist
                  </h2>
                </div>
                <ul className="mt-3 space-y-3">
                  {analysis.compliance.map((item, i) => (
                    <li key={i} className="flex gap-2.5 text-sm">
                      {complianceIcon(item.status)}
                      <div>
                        <p className="font-medium text-foreground">{item.item}</p>
                        <p className="text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card>
                <div className="flex items-center gap-2">
                  <CalendarX2 className="size-4 text-primary" />
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Deadlines & renewals
                  </h2>
                </div>
                {analysis.deadlines.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No date-driven obligations found in this document.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {analysis.deadlines.map((d, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 text-sm">
                        <div>
                          <p className="font-medium text-foreground">{d.label}</p>
                          <p className="text-xs capitalize text-muted-foreground">{d.kind}</p>
                        </div>
                        <Badge tone="neutral" className="shrink-0">
                          {formatDate(d.date)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="sm:col-span-2">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Recommended next steps
                </h2>
                <ol className="mt-3 space-y-2.5">
                  {analysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/12 font-display text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed text-foreground">{rec}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            </div>

            {/* AI assistant */}
            <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
              <ChatPanel contract={contract} />
            </div>
          </div>
        ) : (
          <Card className="mt-8 flex flex-col items-center gap-4 py-16 text-center">
            <FileText className="size-8 text-muted-foreground" />
            <Button onClick={retry}>Start analysis</Button>
          </Card>
        )}
      </main>
    </div>
  );
}
